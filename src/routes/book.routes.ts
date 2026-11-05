
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db";
import {
    authenticate,
    AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

const validCategories = [
    "Fiction",
    "Science",
    "History",
    "Kids",
    "Others",
];

// GET ALL BOOKS - Public
router.get("/", async (req, res) => {
    try {
        const { email, userId, limit, category, search } = req.query;
        const filter: any = {};

        if (email && typeof email === "string" && email.trim()) {
            filter["addedBy.email"] = { $regex: new RegExp("^" + email.trim() + "$", "i") };
        } else if (userId && typeof userId === "string" && userId.trim()) {
            filter["addedBy.userId"] = userId.trim();
        }

        if (category && typeof category === "string" && category !== "All") {
            filter.category = category;
        }

        if (search && typeof search === "string" && search.trim()) {
            filter.$or = [
                { title: { $regex: search.trim(), $options: "i" } },
                { author: { $regex: search.trim(), $options: "i" } },
            ];
        }

        let cursor = getDB()
            .collection("books")
            .find(filter)
            .sort({ createdAt: -1 });

        if (limit && !isNaN(Number(limit))) {
            cursor = cursor.limit(Number(limit));
        }

        const books = await cursor.toArray();

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


// ADD BOOK - Login required
router.post("/", authenticate, async (req, res) => {
    try {
        const authenticatedReq = req as AuthenticatedRequest;
        const user = authenticatedReq.auth;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
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

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof author !== "string" ||
            !author.trim() ||
            typeof category !== "string" ||
            typeof imageUrl !== "string" ||
            !imageUrl.trim() ||
            typeof description !== "string" ||
            !description.trim() ||
            !Number.isInteger(totalCopies) ||
            totalCopies < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required book information.",
            });
        }

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
                userId: user.userId,
                name: user.name,
                email: user.email,
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


// GET SINGLE BOOK - Public
router.get("/:id", async (req, res) => {
    try {
        const id = req.params.id;

        if (typeof id !== "string" || !ObjectId.isValid(id)) {
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


// UPDATE BOOK - Owner only
router.patch("/:id", authenticate, async (req, res) => {
    try {
        const authenticatedReq = req as AuthenticatedRequest;
        const user = authenticatedReq.auth;
        const id = req.params.id;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        if (typeof id !== "string" || !ObjectId.isValid(id)) {
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
            if (
                typeof category !== "string" ||
                !validCategories.includes(category)
            ) {
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
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid book description.",
                });
            }

            updates.description = description.trim();
        }

        const database = getDB();
        const booksCollection = database.collection("books");
        const bookObjectId = new ObjectId(id);

        const existingBook = await booksCollection.findOne({
            _id: bookObjectId,
            "addedBy.userId": user.userId,
        });

        if (!existingBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not its owner.",
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
                    message:
                        "Total copies cannot be less than currently borrowed copies.",
                });
            }

            updates.totalCopies = totalCopies;
            updates.availableCopies = totalCopies - borrowedCopies;
        }

        const updatedBook = await booksCollection.findOneAndUpdate(
            {
                _id: bookObjectId,
                "addedBy.userId": user.userId,
            },
            { $set: updates },
            { returnDocument: "after" }
        );

        if (!updatedBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not its owner.",
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


// DELETE BOOK - Owner only
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const authenticatedReq = req as AuthenticatedRequest;
        const user = authenticatedReq.auth;
        const id = req.params.id;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        if (typeof id !== "string" || !ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid book ID.",
            });
        }

        const database = getDB();
        const booksCollection = database.collection("books");
        const borrowsCollection = database.collection("borrows");
        const bookObjectId = new ObjectId(id);

        const existingBook = await booksCollection.findOne({
            _id: bookObjectId,
            "addedBy.userId": user.userId,
        });

        if (!existingBook) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not its owner.",
            });
        }

        const activeBorrow = await borrowsCollection.findOne({
            bookId: id,
        });

        if (activeBorrow) {
            return res.status(409).json({
                success: false,
                message:
                    "This book cannot be deleted while it has active borrowing records.",
            });
        }

        const result = await booksCollection.deleteOne({
            _id: bookObjectId,
            "addedBy.userId": user.userId,
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found or you are not its owner.",
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
