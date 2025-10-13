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

//model
const Users = mongoose.model("users", usersSchema, "users");

const Portfolio = mongoose.model("portfolio", portfolioSchema, "portfolio");

const Feedback = mongoose.model("feedback", feedbackSchema, "feedback");

module.exports = {
  Users,
  Portfolio,
  Feedback,
};
