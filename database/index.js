const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://raghavendrakv23:Raghavendra23@cluster0.qj6ks.mongodb.net/floop"
);

//schemas
const usersSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    role: String,
  },
  { timestamps: true }
);

const portfolioSchema = new mongoose.Schema(
  {
    portfolioLink: String,
    associatedToUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revieweeName: String,
    revieweeEmail: String,
    reviewerName: String,
    reviewerEmail: String,
    goals: String,
    emailInvites: String,
    accessType: String,
    isOpened: { type: Boolean, default: false },
    openedAt: Date,
    openCount: Number,
    commentCount: Number,
  },
  { timestamps: true }
);

const feedbackSchema = new mongoose.Schema(
  {
    relativePathUrl: String,
    associatedToPortfolio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
    },
    reviewerName: String,
    reviewerEmail: String,
    x: Number,
    y: Number,
    feedback: String,
  },
  { timestamps: true }
);

const historySchema = new mongoose.Schema(
  {
    associatedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    associatedToPortfolio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      default: null,
    },
    eventType: {
      type: String,
      enum: ["OPENED", "COMMENTED", "UPDATED", "CREATED"],
      required: true,
    },
    activityDate: {
      type: String,
      required: true,
    },
    message: String,
    type: {
      type: String,
      default: null,
    },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

//model
const Users = mongoose.model("users", usersSchema, "users");

const Portfolio = mongoose.model("portfolio", portfolioSchema, "portfolio");

const Feedback = mongoose.model("feedback", feedbackSchema, "feedback");

const History = mongoose.model("history", historySchema, "history");

module.exports = {
  Users,
  Portfolio,
  Feedback,
  History,
};
