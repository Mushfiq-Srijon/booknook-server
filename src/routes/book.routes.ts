import { Router } from "express";
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

export default router;