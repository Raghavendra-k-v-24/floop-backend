const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const chromium = require("chrome-aws-lambda");

const { BASE_URL } = require("./config");

const secret = "Ws6alQNX3ZHExnxqjISK9cIff2iXywy2";

const { Users, Portfolio, Feedback } = require("./database");

const app = express();

app.use([
  cors({
    origin: BASE_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
  express.static("public"),
]);

app.use(bodyParser.json());

async function getFeedbacks(targetUrl, portfolioId) {
  if (!portfolioId || portfolioId.trim() === "") {
    return [];
  }
  const feedbacks = await Feedback.find({
    relativePathUrl: targetUrl,
    associatedToPortfolio: portfolioId,
  });
  return feedbacks;
}

app.post("/login", async function (req, res) {
  try {
    const data = req.body;
    const { email, password } = data;
    const user = await Users.findOne({ email });
    if (!user) return res.status(400).json({ data: "User not found" });
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({
        data: "Wrong Password. Try again!",
      });
    res.status(200).json({
      data: {
        name: user.name,
        email: user.email,
        role: user.role,
        id: user._id.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      data: "Something went wrong. Try again!",
    });
  }
});

app.post("/signup", async function (req, res) {
  try {
    const data = req.body;
    const {
      name,
      email,
      password,
      role,
      portfolioLink,
      revieweeName,
      revieweeEmail,
      reviewerName,
      reviewerEmail,
      goals,
      emailInvites,
      accessType,
      skip,
    } = data;
    const existingUser = await Users.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ data: "User already exists" });
    }

    const isSkip = skip === true;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new Users({ name, email, password: hashedPassword, role });
    const userId = newUser._id;
    await newUser.save();

    if (!isSkip) {
      const newPortfolio = new Portfolio({
        portfolioLink,
        associatedToUser: userId,
        revieweeName: role === "reviewee" ? name : revieweeName,
        revieweeEmail: role === "reviewee" ? email : revieweeEmail,
        reviewerName: role === "reviewer" ? name : reviewerName,
        reviewerEmail: role === "reviewer" ? email : reviewerEmail,
        goals,
        emailInvites,
        accessType,
      });
      const portfolioIdString = newPortfolio._id.toString();
      await newPortfolio.save();
      res.status(200).json({
        data: portfolioIdString,
      });
    }
    res.status(200).json({
      data: null,
    });
  } catch (err) {
    res.status(500).json({
      data: "Something went wrong. Try again!",
    });
  }
});

app.get("/user-exists", async function (req, res) {
  try {
    const { email } = req.query;
    const user = await Users.findOne({ email });
    if (!user) {
      return res.status(200).json({
        data: "User does not exists",
      });
    } else {
      return res.status(409).json({
        data: "User exists",
      });
    }
  } catch (err) {
    res.status(500).json({
      data: "Something went wrong. Try again!",
    });
  }
});

app.get("/portfolio", async function (req, res) {
  try {
    const { email, id } = req.query;
    if (email) {
      const portfolios = await Portfolio.find({
        $or: [{ revieweeEmail: email }, { reviewerEmail: email }],
      });
      return res.status(200).json({
        data: portfolios,
      });
    } else if (id) {
      const portfolio = await Portfolio.findById(id);
      return res.status(200).json({
        data: portfolio,
      });
    }
  } catch (err) {
    res.status(500).json({
      data: "Something went wrong. Try again!",
    });
  }
});

app.put("/portfolio", async function (req, res) {
  try {
    const data = req.body;
    const { portfolioId, emailInvites, accessType } = data;
    await Portfolio.updateOne(
      { _id: portfolioId },
      { $set: { emailInvites: emailInvites, accessType: accessType } }
    );
    res.status(200).json({
      data: null,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
    });
  }
});

app.get("/feedback/:id", async function (req, res) {
  try {
    const associatedTo = req.params.id;
    const feedbacks = await Portfolio.find({ "associatedTo": associatedTo });
    res.status(200).json({
      data: feedbacks,
    });
  } catch (err) {
    res.status(500).json({
      data: err,
    });
  }
});

app.get("/feedback-count", async function (req, res) {
  try {
    const email = req.query.email;
    const receivedPortfolios = await Portfolio.find({ "revieweeEmail": email });
    const receivedPortfolioIds = receivedPortfolios.map((p) => p._id);

    const receivedFeedbackCount = await Feedback.countDocuments({
      "associatedToPortfolio": { $in: receivedPortfolioIds },
    });

    const givenPortfolios = await Portfolio.find({ "reviewerEmail": email });
    const givenPortfolioIds = givenPortfolios.map((p) => p._id);

    const givenFeedbackCount = await Feedback.countDocuments({
      "associatedToPortfolio": { $in: givenPortfolioIds },
    });

    res.status(200).json({
      data: {
        receivedFeedbackCount: receivedFeedbackCount,
        givenFeedbackCount: givenFeedbackCount,
      },
    });
  } catch (err) {
    res.status(500).json({
      data: err,
    });
  }
});

app.post("/portfolio", async function (req, res) {
  try {
    const data = req.body;
    const newRecord = new Portfolio(data);
    const idString = newRecord._id.toString();
    newRecord.save();
    res.status(200).json({
      data: idString,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
    });
  }
});

app.post("/generate-token", async function (req, res) {
  try {
    const data = JSON.stringify(req.body);
    const encoded = Buffer.from(data).toString("base64url");
    res.status(200).json({
      data: encoded,
    });
  } catch (err) {
    res.status(500).json({
      data: null,
    });
  }
});

app.post("/save-feedback", async (req, res) => {
  try {
    const {
      relativePathUrl,
      associatedToPortfolio,
      reviewerName,
      reviewerEmail,
      x,
      y,
      feedback,
    } = req.body;

    if (!relativePathUrl || !feedback) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const data = {
      relativePathUrl,
      associatedToPortfolio,
      reviewerName,
      reviewerEmail,
      x,
      y,
      feedback,
    };
    const newFeedback = new Feedback(data);
    await newFeedback.save();
    res.status(200).json({
      data: "Feedback saved!",
    });
  } catch (err) {
    console.error("Error saving feedback:", err);
    res.status(500).json({ data: "Failed to save feedback" });
  }
});

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  const portfolioId = req.query.portfolioId || "";
  const reviewerName = req.query.reviewerName || "";
  const reviewerEmail = req.query.reviewerEmail || "";

  if (!targetUrl) {
    return res.status(400).send("Missing ?url parameter");
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: "text",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const contentType = response.headers["content-type"] || "text/html";
    res.setHeader("Content-Type", contentType);

    // 🛑 Remove headers that block iframing
    res.removeHeader("x-frame-options");
    res.removeHeader("content-security-policy");

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(targetUrl);
      const encodedPortfolioId = encodeURIComponent(portfolioId || "Undefined");
      const encodedReviewerName = encodeURIComponent(
        reviewerName || "Anonymous"
      );
      const encodedReviewerEmail = encodeURIComponent(
        reviewerEmail || "Anonymous"
      );

      // Fetch existing feedbacks
      let existingFeedbacks = [];
      try {
        existingFeedbacks = await getFeedbacks(targetUrl, portfolioId);
      } catch (err) {
        console.error("Error fetching feedbacks:", err);
      }

      // Helper to rewrite URLs
      const rewriteUrl = (url) => {
        if (!url) return url;
        if (url.startsWith("http") || url.startsWith("mailto"))
          return `/proxy?url=${encodeURIComponent(
            url
          )}&portfolioId=${encodedPortfolioId}&reviewerName=${encodedReviewerName}&reviewerEmail=${encodedReviewerEmail}`;
        return `/proxy?url=${encodeURIComponent(
          new URL(url, baseUrl).toString()
        )}&portfolioId=${encodedPortfolioId}&reviewerName=${encodedReviewerName}&reviewerEmail=${encodedReviewerEmail}`;
      };

      // Fix links
      $("a").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });

      // Fix scripts, styles, images, iframes
      $("script").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("link").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });
      $("img").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("iframe").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });

      const commentScript = `
        window.commentMode = false;
        window.comments = [];
        window.portfolioId = "${portfolioId || "Undefined"}";
        window.reviewerName = "${reviewerName || "Anonymous"}";
        window.reviewerEmail = "${reviewerEmail || "Anonymous"}";

        window.addEventListener("message", (event) => {
          if (event.data?.type === "toggleCommentMode") {
            window.commentMode = event.data.mode;
          }
        });

        // window.addEventListener("message", (event) => {
        //   if (event.data?.type === "toggleCommentMode") {
        //     window.commentMode = event.data.mode;
        //     if (window.commentMode) {
        //       enableDrawingMode();
        //     } else {
        //       removeDrawingOverlay();
        //     }
        //   }
        // });

        function adjustCardPosition(card, x, y, offset = 20) {
          // Temporarily set position so we can measure
          card.style.left = x + "px";
          card.style.top = y + "px";

          // Get actual rendered dimensions
          const rect = card.getBoundingClientRect();
          const cardWidth = rect.width;
          const cardHeight = rect.height;

          console.log(cardWidth, cardHeight);

          let finalX = x;
          let finalY = y;

          // Check horizontal overflow
          if (x + cardWidth + offset > window.innerWidth) {
            finalX = x - cardWidth - offset;
          }

          // Check vertical overflow
          if (y + cardHeight + offset > window.innerHeight) {
            finalY = y - cardHeight - offset;
          }

          // Apply final position
          card.style.left = finalX + "px";
          card.style.top = finalY + "px";
        }

        function createCommentCard(x, y) {
          // Remove any existing input commentCard
          const existing = document.getElementById('comment-card');
          if (existing) existing.remove();

          let cardX = x;
          let cardY = y; 

          if(x + 300 >= window.innerWidth){
            cardX = cardX - 320;
          }

          if(y + 250 >= window.innerHeight){
            cardY = cardY - 250;
          }


          // Create commentCard container
          const commentCard = document.createElement('div');
          commentCard.id = 'comment-card';
          commentCard.style.position = 'absolute';
          commentCard.style.left = cardX + 'px';
          commentCard.style.top = cardY + 'px';
          commentCard.style.background = 'white';
          commentCard.style.width = '300px';
          commentCard.style.height='250px';
          commentCard.style.display='flex';
          commentCard.style.flexDirection='column';
          commentCard.style.border='2px solid #EBEFF4';
          commentCard.style.borderRadius = '12px';
          commentCard.style.padding = '12px';
          commentCard.style.gap='8px';
          commentCard.style.zIndex='1000000';

          const commentHeader = document.createElement('div');
          commentHeader.style.width = '100%';
          commentHeader.style.display = 'flex';

          const commentTitle = document.createElement('div');
          commentTitle.textContent = 'Comment';
          commentTitle.style.fontWeight = '600';

          commentHeader.appendChild(commentTitle);
          commentCard.appendChild(commentHeader);

          const commentBody = document.createElement('div');
          commentBody.style.width = '100%';
          commentBody.style.flexGrow = '1';
          commentBody.style.border = '2px solid #EBEFF4';
          commentBody.style.borderRadius = '12px';
          commentBody.style.backgroundColor = '#F9FAFB';
          commentBody.style.padding = '5px';
          commentBody.style.textAlign ='justify';

          // Input element
          const input = document.createElement('textarea');
          input.placeholder = 'Enter comment...';
          input.id = "comment"
          input.rows = 4;
          input.style.width = '100%';
          input.style.height = '100%';
          input.style.outlineWidth = '0px';
          input.style.backgroundColor = '#F9FAFB';
          input.style.border = '0px';
          input.style.padding = '5px';

          commentBody.appendChild(input);
          commentCard.appendChild(commentBody);


          // Footer
          const commentFooter = document.createElement('div');
          commentFooter.style.display= 'flex';
          commentFooter.style.gap = '8px';

          const submitButton = document.createElement('button');
          submitButton.textContent = 'Submit';
          submitButton.style.width='max-content';
          submitButton.style.height = 'max-content';
          submitButton.style.padding ='4px 12px';
          submitButton.style.borderRadius = '4px';
          submitButton.style.backgroundColor='#3a3cff';
          submitButton.style.color = 'white';
          submitButton.style.fontSize='14px';
          submitButton.style.border='1px solid transparent';

          commentCard.appendChild(commentFooter);



          submitButton.onclick = () => {
            const text = input.value.trim();
            if (!text) return;

            const relativePathUrl = decodeURIComponent(
              new URLSearchParams(window.location.search).get("url")
            );

            window.comments.push({ x, y, text });

            axios.post('/save-feedback', {
                    relativePathUrl,
                    associatedToPortfolio:  window.portfolioId,
                    reviewerName: window.reviewerName,
                    reviewerEmail: window.reviewerEmail,
                    x : x / window.innerWidth,
                    y : y / window.innerHeight,
                    feedback: text
              })
              .then(res => console.log("✅ Feedback saved:", res.data))
              .catch(err => console.error("❌ Error saving feedback:", err));


            // Create pin image
            const pin = document.createElement('img');
            // pin.src = 'http://localhost:5174/pin.png';
            pin.src = '${BASE_URL}/pin.png';
            pin.style.position = 'absolute';
            pin.style.left = x + 'px';
            pin.style.top = y + 'px';
            pin.style.width = '40px';
            pin.style.height = '40px';
            pin.style.cursor = 'pointer';
            pin.style.zIndex = 9999;


            const feedbackCard = document.createElement('div');
            feedbackCard.style.position = 'absolute';
            feedbackCard.style.left = cardX + 'px';
            feedbackCard.style.top = cardY + 50 + 'px';
            feedbackCard.style.background = 'white';
            feedbackCard.style.border = '2px solid #EBEFF4';
            feedbackCard.style.borderRadius = '12px';
            feedbackCard.style.padding = '12px';
            feedbackCard.style.width = '300px';
            feedbackCard.style.height = 'max';
            feedbackCard.style.zIndex = 10000;
            feedbackCard.style.display = 'none'; // initially hidden
            feedbackCard.style.flexDirection = 'column';
            feedbackCard.style.gap = '8px';


            const feedbackHeader = document.createElement('div');
            feedbackHeader.style.width = '100%';
            feedbackHeader.style.display = 'flex';
            feedbackHeader.style.justifyContent = 'space-between'

            const feedbackTitle = document.createElement('div');
            feedbackTitle.textContent = 'Feedback';
            feedbackTitle.style.fontWeight = '600';

            const closeImg = document.createElement('img');
              // closeImg.src = 'http://localhost:5174/cross.png';
              closeImg.src = '${BASE_URL}/cross.png';
              closeImg.style.width = '20px';
              closeImg.style.height = '20px';
              closeImg.style.cursor = 'pointer';
              closeImg.onclick = () => {
              feedbackCard.style.display = 'none';
            };

            feedbackHeader.appendChild(feedbackTitle);
            feedbackHeader.appendChild(closeImg);

            const feedbackBody = document.createElement('div');
            feedbackBody.style.width = '100%';
            feedbackBody.style.flexGrow = '1';
            feedbackBody.style.border = '2px solid #EBEFF4';
            feedbackBody.style.borderRadius = '12px';
            feedbackBody.style.backgroundColor = '#F9FAFB';
            feedbackBody.style.padding = '12px';
            feedbackBody.style.textAlign ='justify';

            const content = document.createElement('div');
            content.textContent = text;

            feedbackBody.appendChild(content);


            feedbackCard.appendChild(feedbackHeader);
            feedbackCard.appendChild(feedbackBody);

            // Toggle tooltip on pin click
            pin.onclick = (e) => {
              e.stopPropagation();
              feedbackCard.style.display = feedbackCard.style.display === 'none' ? 'flex' : 'none';
            };

            // Append pin + tooltip
            document.body.appendChild(pin);
            document.body.appendChild(feedbackCard);

            // Save comment data
            window.comments.push({ x, y, text });

            // Remove input commentCard after submit
            commentCard.remove();
          };

          commentFooter.appendChild(submitButton);

          const cancelButton = document.createElement('button');
          cancelButton.textContent = 'Cancel';
          cancelButton.style.width='max-content';
          cancelButton.style.height = 'max-content';
          cancelButton.style.padding ='4px 12px';
          cancelButton.style.borderRadius = '4px';
          cancelButton.style.fontSize='14px';
          cancelButton.style.border='1px solid #EBEFF4';
          cancelButton.onclick = () => commentCard.remove();

          commentFooter.appendChild(cancelButton);
          document.body.appendChild(commentCard);
          input.focus();
        }

        // diff logic+
        ['click', 'mousedown', 'mouseup'].forEach(eventType => {
        document.addEventListener(
          eventType,
          function(e) {
            if (!window.commentMode) return;
            if (e.target.closest('#comment-card')) return;

            // Stop everything
            e.preventDefault();
            e.stopPropagation();

            // Only create comment on the initial click
            if (eventType === 'click') {
              const x = e.pageX;
              const y = e.pageY;
              createCommentCard(x, y);
            }
          },
          { capture: true } // important: intercept events in capturing phase
        );
      });
      `;

      const initialFeedbackLoadingScript = `
        const existingFeedbacks = ${JSON.stringify(existingFeedbacks)};

        existingFeedbacks.forEach(f => {
            const pin = document.createElement('img');
            const pinX = f.x * window.innerWidth;
            const pinY = f.y * window.innerHeight;
            // pin.src = 'http://localhost:5174/pin.png';  
            pin.src = '${BASE_URL}/pin.png';  
            pin.style.position = 'absolute';
            pin.style.left = pinX + 'px';
            pin.style.top = pinY + 'px';
            pin.style.width = '40px';
            pin.style.height = '40px';
            pin.style.cursor = 'pointer';
            pin.style.zIndex = 9999;

            let cardX = pinX;
            let cardY = pinY; 

            if(pinX + 300 >= window.innerWidth){
              cardX = cardX - 320;
            }

            if(pinY + 250 >= window.innerHeight){
              cardY = cardY - 250;
            }

            const feedbackCard = document.createElement('div');
            feedbackCard.style.position = 'absolute';
            feedbackCard.style.left = cardX + 'px';
            feedbackCard.style.top = (cardY + 50) + 'px';
            feedbackCard.style.background = 'white';
            feedbackCard.style.border = '2px solid #EBEFF4';
            feedbackCard.style.borderRadius = '12px';
            feedbackCard.style.padding = '12px';
            feedbackCard.style.width = '300px';
            feedbackCard.style.height = '250px';
            feedbackCard.style.zIndex = 10000;
            feedbackCard.style.display = 'none'; // initially hidden
            feedbackCard.style.flexDirection = 'column';
            feedbackCard.style.gap = '8px';


            const feedbackHeader = document.createElement('div');
            feedbackHeader.style.width = '100%';
            feedbackHeader.style.display = 'flex';
            feedbackHeader.style.justifyContent = 'space-between'

            const feedbackTitle = document.createElement('div');
            feedbackTitle.textContent = 'Feedback';
            feedbackTitle.style.fontWeight = '600';

            const closeImg = document.createElement('img');
            // closeImg.src = 'http://localhost:5174/cross.png';
            closeImg.src = '${BASE_URL}/cross.png';
            closeImg.style.width = '20px';
            closeImg.style.height = '20px';
            closeImg.style.cursor = 'pointer';
            closeImg.onclick = () => {
            feedbackCard.style.display = 'none';};

            feedbackHeader.appendChild(feedbackTitle);
            feedbackHeader.appendChild(closeImg);

            const feedbackBody = document.createElement('div');
            feedbackBody.style.width = '100%';
            feedbackBody.style.flexGrow = '1';
            feedbackBody.style.border = '2px solid #EBEFF4';
            feedbackBody.style.borderRadius = '12px';
            feedbackBody.style.backgroundColor = '#F9FAFB';
            feedbackBody.style.padding = '12px';
            feedbackBody.style.textAlign ='justify';

            const content = document.createElement('div');
            content.textContent = f.feedback;

            feedbackBody.appendChild(content);


            feedbackCard.appendChild(feedbackHeader);
            feedbackCard.appendChild(feedbackBody);

            // // Toggle tooltip on pin click
            pin.onclick = (e) => {
              e.stopPropagation();
              feedbackCard.style.display = 'flex';
            };

            // Append pin + tooltip
            document.body.appendChild(pin);
            document.body.appendChild(feedbackCard);

        });
      `;
      $("body").append(
        `<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>`
      );
      $("body").append(`<script>${commentScript}<\/script>`);
      $("body").append(`<script>${initialFeedbackLoadingScript}<\/script>`);

      res.send($.html());
    } else {
      // Non-HTML (e.g. images, CSS, fonts)
      res.send(response.data);
    }
  } catch (error) {
    res.status(500).send("Error fetching target URL: " + error.message);
  }
});

app.get("/proxy-dashboard", async (req, res) => {
  const targetUrl = req.query.url;
  const portfolioId = req.query.portfolioId || "";

  if (!targetUrl) {
    return res.status(400).send("Missing ?url parameter");
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: "text",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const contentType = response.headers["content-type"] || "text/html";
    res.setHeader("Content-Type", contentType);

    // 🛑 Remove headers that block iframing
    res.removeHeader("x-frame-options");
    res.removeHeader("content-security-policy");

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(targetUrl);

      // Fetch existing feedbacks
      let existingFeedbacks = [];
      try {
        existingFeedbacks = await getFeedbacks(targetUrl, portfolioId);
      } catch (err) {
        console.error("Error fetching feedbacks:", err);
      }

      // Helper to rewrite URLs
      const rewriteUrl = (url) => {
        if (!url) return url;
        if (url.startsWith("http") || url.startsWith("mailto"))
          return `/proxy?url=${encodeURIComponent(
            url
          )}&portfolioId=${encodeURIComponent(portfolioId)}`;
        return `/proxy?url=${encodeURIComponent(
          new URL(url, baseUrl).toString()
        )}&portfolioId=${encodeURIComponent(portfolioId)}`;
      };

      // Fix links
      $("a").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });

      // Fix scripts, styles, images, iframes
      $("script").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("link").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });
      $("img").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("iframe").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });

      const initialFeedbackLoadingScript = `
        const existingFeedbacks = ${JSON.stringify(existingFeedbacks)};

        existingFeedbacks.forEach(f => {
            const pin = document.createElement('img');
            const pinX = f.x * window.innerWidth;
            const pinY = f.y * window.innerHeight;
            // pin.src = 'http://localhost:5174/pin.png';
            pin.src = '${BASE_URL}/pin.png';
            pin.style.position = 'absolute';
            pin.style.left = pinX + 'px';
            pin.style.top = pinY + 'px';
            pin.style.width = '40px';
            pin.style.height = '40px';
            pin.style.cursor = 'pointer';
            pin.style.zIndex = 9999;

            let cardX = pinX;
            let cardY = pinY; 

            if(pinX + 300 >= window.innerWidth){
              cardX = cardX - 320;
            }

            if(pinY + 250 >= window.innerHeight){
              cardY = cardY - 250;
            }

            const feedbackCard = document.createElement('div');
            feedbackCard.style.position = 'absolute';
            feedbackCard.style.left = cardX + 'px';
            feedbackCard.style.top = (cardY + 50) + 'px';
            feedbackCard.style.background = 'white';
            feedbackCard.style.border = '2px solid #EBEFF4';
            feedbackCard.style.borderRadius = '12px';
            feedbackCard.style.padding = '12px';
            feedbackCard.style.width = '300px';
            feedbackCard.style.height = 'min-content';
            feedbackCard.style.zIndex = 10000;
            feedbackCard.style.display = 'none'; // initially hidden
            feedbackCard.style.flexDirection = 'column';
            feedbackCard.style.gap = '8px';


            const feedbackHeader = document.createElement('div');
            feedbackHeader.style.width = '100%';
            feedbackHeader.style.display = 'flex';
            feedbackHeader.style.justifyContent = 'space-between'

            const feedbackTitle = document.createElement('div');
            feedbackTitle.textContent = 'Feedback';
            feedbackTitle.style.fontWeight = '600';

            const closeImg = document.createElement('img');
            // closeImg.src = 'http://localhost:5174/cross.png';
            closeImg.src = '${BASE_URL}/cross.png';
            closeImg.style.width = '20px';
            closeImg.style.height = '20px';
            closeImg.style.cursor = 'pointer';
            closeImg.onclick = () => {
            feedbackCard.style.display = 'none';};

            feedbackHeader.appendChild(feedbackTitle);
            feedbackHeader.appendChild(closeImg);

            const feedbackBody = document.createElement('div');
            feedbackBody.style.width = '100%';
            feedbackBody.style.flexGrow = '1';
            feedbackBody.style.border = '2px solid #EBEFF4';
            feedbackBody.style.borderRadius = '12px';
            feedbackBody.style.backgroundColor = '#F9FAFB';
            feedbackBody.style.padding = '12px';
            feedbackBody.style.textAlign ='justify';

            const content = document.createElement('div');
            content.textContent = f.feedback;

            feedbackBody.appendChild(content);


            feedbackCard.appendChild(feedbackHeader);
            feedbackCard.appendChild(feedbackBody);

            // // Toggle tooltip on pin click
            pin.onclick = (e) => {
              e.stopPropagation();
              feedbackCard.style.display = 'flex';
            };

            // Append pin + tooltip
            document.body.appendChild(pin);
            document.body.appendChild(feedbackCard);
        });
      `;
      $("body").append(
        `<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>`
      );
      $("body").append(`<script>${initialFeedbackLoadingScript}<\/script>`);

      res.send($.html());
    } else {
      // Non-HTML (e.g. images, CSS, fonts)
      res.send(response.data);
    }
  } catch (error) {
    res.status(500).send("Error fetching target URL: " + error.message);
  }
});

app.get("/proxy-preview", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send("Missing ?url parameter");
  }

  try {
    const response = await axios.get(targetUrl, {
      responseType: "text",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const contentType = response.headers["content-type"] || "text/html";
    res.setHeader("Content-Type", contentType);

    // 🛑 Remove headers that block iframing
    res.removeHeader("x-frame-options");
    res.removeHeader("content-security-policy");

    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data);
      const baseUrl = new URL(targetUrl);

      // Helper to rewrite URLs
      const rewriteUrl = (url) => {
        if (!url) return url;
        if (url.startsWith("http") || url.startsWith("mailto"))
          return `/proxy?url=${encodeURIComponent(url)}`;
        return `/proxy?url=${encodeURIComponent(
          new URL(url, baseUrl).toString()
        )}`;
      };

      // Fix links
      $("a").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });

      // Fix scripts, styles, images, iframes
      $("script").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("link").each((_, el) => {
        $(el).attr("href", rewriteUrl($(el).attr("href")));
      });
      $("img").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });
      $("iframe").each((_, el) => {
        $(el).attr("src", rewriteUrl($(el).attr("src")));
      });

      res.send($.html());
    } else {
      // Non-HTML (e.g. images, CSS, fonts)
      res.send(response.data);
    }
  } catch (error) {
    res.status(500).send("Error fetching target URL: " + error.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
