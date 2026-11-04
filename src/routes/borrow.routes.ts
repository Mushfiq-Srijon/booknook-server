
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db";

const router = Router();

router.post("/", async (req, res) => {
    try {
        const { bookId, userEmail } = req.body;

        if (
            typeof bookId !== "string" ||
            !ObjectId.isValid(bookId) ||
            typeof userEmail !== "string" ||
            !userEmail.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid book ID and user email.",
            });
        }

        const database = getDB();
        const booksCollection = database.collection("books");
        const borrowsCollection = database.collection("borrows");

        await borrowsCollection.createIndex(
            { bookId: 1, userEmail: 1 },
            { unique: true }
        );

        const bookObjectId = new ObjectId(bookId);

        const book = await booksCollection.findOne({
            _id: bookObjectId,
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "Book not found.",
            });
        }

        const normalizedEmail = userEmail.trim().toLowerCase();

        const existingBorrow = await borrowsCollection.findOne({
            bookId,
            userEmail: normalizedEmail,
        });

        if (existingBorrow) {
            return res.status(409).json({
                success: false,
                message: "You have already borrowed this book.",
            });
        }

        const updatedBook = await booksCollection.findOneAndUpdate(
            {
                _id: bookObjectId,
                availableCopies: { $gt: 0 },
            },
            {
                $inc: { availableCopies: -1 },
                $set: { updatedAt: new Date() },
            },
            { returnDocument: "after" }
        );

        if (!updatedBook) {
            return res.status(409).json({
                success: false,
                message: "No copies of this book are currently available.",
            });
        }

        const borrowDate = new Date();
        const returnDate = new Date(borrowDate);
        returnDate.setDate(returnDate.getDate() + 14);

        const newBorrow = {
            bookId,
            bookTitle: updatedBook.title,
            bookImage: updatedBook.imageUrl,
            userEmail: normalizedEmail,
            borrowDate,
            returnDate,
        };

        try {
            const result = await borrowsCollection.insertOne(newBorrow);

            res.status(201).json({
                success: true,
                message: "Book borrowed successfully.",
                data: {
                    ...newBorrow,
                    _id: result.insertedId.toString(),
                    borrowDate: borrowDate.toISOString(),
                    returnDate: returnDate.toISOString(),
                },
            });
        } catch (error) {
            await booksCollection.updateOne(
                { _id: bookObjectId },
                {
                    $inc: { availableCopies: 1 },
                    $set: { updatedAt: new Date() },
                }
            );

            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === 11000
            ) {
                return res.status(409).json({
                    success: false,
                    message: "You have already borrowed this book.",
                });
            }

            throw error;
        }
    } catch (error) {
        console.error("Error borrowing book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to borrow book.",
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const borrows = await getDB()
            .collection("borrows")
            .find({})
            .sort({ borrowDate: -1 })
            .toArray();

        const formattedBorrows = borrows.map((borrow) => ({
            ...borrow,
            _id: borrow._id.toString(),
            borrowDate:
                borrow.borrowDate instanceof Date
                    ? borrow.borrowDate.toISOString()
                    : borrow.borrowDate,
            returnDate:
                borrow.returnDate instanceof Date
                    ? borrow.returnDate.toISOString()
                    : borrow.returnDate,
        }));

        res.status(200).json({
            success: true,
            count: formattedBorrows.length,
            data: formattedBorrows,
        });
    } catch (error) {
        console.error("Error fetching borrows:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch borrowing records.",
        });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid borrow ID.",
            });
        }

        const database = getDB();
        const borrowsCollection = database.collection("borrows");
        const booksCollection = database.collection("books");

        const deletedBorrow = await borrowsCollection.findOneAndDelete({
            _id: new ObjectId(id),
        });

        if (!deletedBorrow) {
            return res.status(404).json({
                success: false,
                message: "Borrowing record not found.",
            });
        }

        const bookUpdate = await booksCollection.updateOne(
            { _id: new ObjectId(deletedBorrow.bookId) },
            {
                $inc: { availableCopies: 1 },
                $set: { updatedAt: new Date() },
            }
        );

        if (bookUpdate.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "The borrowed book no longer exists.",
            });
        }

        res.status(200).json({
            success: true,
            message: "Book returned successfully.",
        });
    } catch (error) {
        console.error("Error returning book:", error);

        res.status(500).json({
            success: false,
            message: "Failed to return book.",
        });
    }
});

export default router;
