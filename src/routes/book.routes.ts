import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const books = await getDB()
            .collection("books")
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        const formattedBooks = books.map((book) => ({
            ...book,
            _id: book._id.toString(),
            createdAt:
                book.createdAt instanceof Date
                    ? book.createdAt.toISOString()
                    : book.createdAt,
            updatedAt:
                book.updatedAt instanceof Date
                    ? book.updatedAt.toISOString()
                    : book.updatedAt,
        }));

        res.status(200).json({
            success: true,
            count: formattedBooks.length,
            data: formattedBooks,
        });
    } catch (error) {
        console.error("Error fetching books:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch books.",
        });
    }
});


router.post("/", async (req, res) => {
    try {
        const {
            title,
            author,
            category,
            imageUrl,
            description,
            totalCopies,
        } = req.body;

        if (
            !title ||
            !author ||
            !category ||
            !imageUrl ||
            !description ||
            !Number.isInteger(totalCopies) ||
            totalCopies < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required book information.",
            });
        }

        const validCategories = [
            "Fiction",
            "Science",
            "History",
            "Kids",
            "Others",
        ];

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book category.",
            });
        }

        const newBook = {
            title: title.trim(),
            author: author.trim(),
            category,
            imageUrl: imageUrl.trim(),
            description: description.trim(),
            totalCopies,
            availableCopies: totalCopies,
            addedBy: {
                name: "Pending authentication",
                email: "pending-auth@booknook.local",
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await getDB()
            .collection("books")
            .insertOne(newBook);

        res.status(201).json({
            success: true,
            message: "Book added successfully.",
            data: {
                ...newBook,
                _id: result.insertedId.toString(),
                createdAt: newBook.createdAt.toISOString(),
                updatedAt: newBook.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("Error adding book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add book.",
        });
    }
});


router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book ID.",
            });
        }

        const book = await getDB()
            .collection("books")
            .findOne({ _id: new ObjectId(id) });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ...book,
                _id: book._id.toString(),
                createdAt:
                    book.createdAt instanceof Date
                        ? book.createdAt.toISOString()
                        : book.createdAt,
                updatedAt:
                    book.updatedAt instanceof Date
                        ? book.updatedAt.toISOString()
                        : book.updatedAt,
            },
        });
    } catch (error) {
        console.error("Error fetching book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch book.",
        });
    }
});


router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book ID.",
            });
        }

        const {
            title,
            author,
            category,
            imageUrl,
            description,
            totalCopies,
        } = req.body;

        const allowedCategories = [
            "Fiction",
            "Science",
            "History",
            "Kids",
            "Others",
        ];

        const updates: {
            title?: string;
            author?: string;
            category?: string;
            imageUrl?: string;
            description?: string;
            totalCopies?: number;
            availableCopies?: number;
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (title !== undefined) {
            if (typeof title !== "string" || !title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book title.",
                });
            }

            updates.title = title.trim();
        }

        if (author !== undefined) {
            if (typeof author !== "string" || !author.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid author name.",
                });
            }

            updates.author = author.trim();
        }

        if (category !== undefined) {
            if (!allowedCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book category.",
                });
            }

            updates.category = category;
        }

        if (imageUrl !== undefined) {
            if (typeof imageUrl !== "string" || !imageUrl.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image URL.",
                });
            }

            updates.imageUrl = imageUrl.trim();
        }

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                !description.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book description.",
                });
            }

            updates.description = description.trim();
        }

        const database = getDB();
        const booksCollection = database.collection("books");

        const existingBook = await booksCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!existingBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        if (totalCopies !== undefined) {
            if (
                !Number.isInteger(totalCopies) ||
                totalCopies < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Total copies must be a positive integer.",
                });
            }

            const borrowedCopies =
                existingBook.totalCopies -
                existingBook.availableCopies;

            if (totalCopies < borrowedCopies) {
                return res.status(400).json({
                    success: false,
                    message: "Total copies cannot be less than currently borrowed copies.",
                });
            }

            updates.totalCopies = totalCopies;
            updates.availableCopies = totalCopies - borrowedCopies;
        }

        const updatedBook = await booksCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updates },
            { returnDocument: "after" }
        );

        if (!updatedBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Book updated successfully.",
            data: {
                ...updatedBook,
                _id: updatedBook._id.toString(),
                createdAt:
                    updatedBook.createdAt instanceof Date
                        ? updatedBook.createdAt.toISOString()
                        : updatedBook.createdAt,
                updatedAt:
                    updatedBook.updatedAt instanceof Date
                        ? updatedBook.updatedAt.toISOString()
                        : updatedBook.updatedAt,
            },
        });
    } catch (error) {
        console.error("Error updating book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update book.",
        });
    }
});


router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book ID.",
            });
        }

        const result = await getDB()
            .collection("books")
            .deleteOne({
                _id: new ObjectId(id),
            });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Book deleted successfully.",
        });
    } catch (error) {
        console.error("Error deleting book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete book.",
        });
    }
});


export default router;