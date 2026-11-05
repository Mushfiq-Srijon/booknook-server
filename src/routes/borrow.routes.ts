
import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db";
import {
    authenticate,
    AuthenticatedRequest,
} from "../middleware/auth.middleware";

const router = Router();

// Borrow a book
router.post("/", authenticate, async (req, res) => {
    try {
        const user = (req as AuthenticatedRequest).auth;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const { bookId } = req.body;

        if (
            typeof bookId !== "string" ||
            !ObjectId.isValid(bookId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid book ID.",
            });
        }

        const database = getDB();
        const booksCollection = database.collection("books");
        const borrowsCollection = database.collection("borrows");

        await borrowsCollection.createIndex(
            { bookId: 1, userEmail: 1 },
            { unique: true }
        );

        const normalizedEmail = user.email.trim().toLowerCase();
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
            userId: user.userId,
            userEmail: normalizedEmail,
            borrowDate,
            returnDate,
        };

        try {
            const result = await borrowsCollection.insertOne(newBorrow);

            return res.status(201).json({
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

        return res.status(500).json({
            success: false,
            message: "Failed to borrow book.",
        });
    }
});

// Get only the logged-in user's borrowing records
router.get("/", authenticate, async (req, res) => {
    try {
        const user = (req as AuthenticatedRequest).auth;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const borrows = await getDB()
            .collection("borrows")
            .find({ $or: [{ userId: user.userId }, { userEmail: user.email.trim().toLowerCase() }] })
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

        return res.status(200).json({
            success: true,
            count: formattedBorrows.length,
            data: formattedBorrows,
        });
    } catch (error) {
        console.error("Error fetching borrows:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch borrowing records.",
        });
    }
});

// Return only the logged-in user's borrowed book
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const user = (req as AuthenticatedRequest).auth;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const id = req.params.id;

        if (typeof id !== "string" || !ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid borrow ID.",
            });
        }

        const database = getDB();
        const borrowsCollection = database.collection("borrows");
        const booksCollection = database.collection("books");

        const borrowObjectId = new ObjectId(id);

        const existingBorrow = await borrowsCollection.findOne({
            _id: borrowObjectId,
            $or: [{ userId: user.userId }, { userEmail: user.email.trim().toLowerCase() }],
        });

        if (!existingBorrow) {
            return res.status(404).json({
                success: false,
                message: "Borrowing record not found.",
            });
        }

        const bookObjectId = new ObjectId(existingBorrow.bookId);

        const book = await booksCollection.findOne({
            _id: bookObjectId,
        });

        if (!book) {
            return res.status(404).json({
                success: false,
                message: "The borrowed book no longer exists.",
            });
        }

        const deletedBorrow = await borrowsCollection.findOneAndDelete({
            _id: borrowObjectId,
            $or: [{ userId: user.userId }, { userEmail: user.email.trim().toLowerCase() }],
        });

        if (!deletedBorrow) {
            return res.status(404).json({
                success: false,
                message: "Borrowing record not found.",
            });
        }

        await booksCollection.updateOne(
            { _id: bookObjectId },
            {
                $inc: { availableCopies: 1 },
                $set: { updatedAt: new Date() },
            }
        );

        return res.status(200).json({
            success: true,
            message: "Book returned successfully.",
        });
    } catch (error) {
        console.error("Error returning book:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to return book.",
        });
    }
});

export default router;
