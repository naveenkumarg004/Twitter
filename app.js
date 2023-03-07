const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const startServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running Successfully at localhost:3000");
    });
  } catch (err) {
    console.log(`DB Error: ${err.message}`);
    process.exit(1);
  }
};

startServer();

// /register/ API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUser = `
    select * from user where username = "${username}"
  `;
  const dbUser = await db.get(getUser);
  //console.log(dbUser);
  if (dbUser === undefined) {
    const isValidPass = password.length >= 6;
    if (isValidPass) {
      const hashedPass = await bcrypt.hash(password, 10);
      const addUser = `
            INSERT INTO
            USER (username,password,name,gender)
            VALUES ("${username}" ,"${hashedPass}" ,"${name}" ,"${gender}" )
        `;
      const addUserQuery = await db.run(addUser);

      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// /login/ API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `
    select * from user where username = "${username}"
  `;
  const checkUserRes = await db.get(checkUser);
  //console.log(checkUserRes);
  if (checkUserRes !== undefined) {
    const isPassCorrect = await bcrypt.compare(password, checkUserRes.password);
    if (isPassCorrect) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "QWERTYKEYPAD");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// token verification
const verifyToken = (request, response, next) => {
  let jswToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jswToken = authHeader.split(" ")[1];
  }
  if (jswToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jswToken, "QWERTYKEYPAD", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
// /user/tweets/feed/ API 3
app.get("/user/tweets/feed/", verifyToken, async (request, response) => {
  const { username } = request;
  const getUser = `
        select * from user where username = "${username}"
    `;
  const getUserRes = await db.get(getUser);
  //console.log(getUserRes);
  const followingUserQuery = `
    select following_user_id from follower 
    where follower_user_id = "${getUserRes.user_id}"
  `;
  const followingUserObjList = await db.all(followingUserQuery);
  //console.log(followingUserObjList);
  const followingUserList = followingUserObjList.map((object) => {
    return object["following_user_id"];
  });
  const getTweetsQuery = `
    select user.name AS username ,
    tweet.tweet AS tweet ,
    tweet.date_time AS dateTime
    from tweet INNER JOIN user ON tweet.user_id = user.user_id 
    where tweet.user_id IN (${followingUserList})
    order by tweet.date_time DESC
    limit 4 ;
  `;
  const tweets = await db.all(getTweetsQuery);
  //console.log(following);
  response.send(tweets);
});
// /user/following/ API 4
app.get("/user/following/", verifyToken, async (request, response) => {
  const { username } = request;
  const getUser = `
        select * from user where username = "${username}"
    `;
  const getUserRes = await db.get(getUser);
  const reqUserId = getUserRes.user_id;
  //console.log(getUserRes);
  const followsQuery = `
    select following_user_id
    from follower
    where follower_user_id =  "${reqUserId}" 
  `;
  const followsQueryRes = await db.all(followsQuery);
  const followsList = followsQueryRes.map((obj) => {
    return obj.following_user_id;
  });
  //console.log(followsList);
  const followNames = `
    select name from user where user.user_id in (${followsList})
  `;
  const followNamesRes = await db.all(followNames);
  response.send(followNamesRes);
  //console.log(followNamesRes);
});

// /user/followers/ API 5

app.get("/user/followers/", verifyToken, async (request, response) => {
  const { username } = request;
  const getUser = `
        select * from user where username = "${username}"
    `;
  const getUserRes = await db.get(getUser);
  const followingUserId = getUserRes.user_id;
  //console.log(followingUserId);
  const getFollowerIds = `
    select follower_user_id
    from follower
    where following_user_id = ${followingUserId}
  `;
  const followerUsersObjectsList = await db.all(getFollowerIds);
  const followerUsersList = followerUsersObjectsList.map((obj) => {
    return obj["follower_user_id"];
  });
  const getFollowersQuery = `
    select user.name AS name from user where user_id in (${followerUsersList})
  `;
  const followers = await db.all(getFollowersQuery);
  response.send(followers);
  //console.log(followers);
});

// /tweets/:tweetId/ API 6
app.get("/tweets/:tweetId/", verifyToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
  const tweetInfo = await db.get(getTweetQuery);

  const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
  const followingUsersObjectsList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time, tweet } = tweetInfo;
    const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
    `;
    const likesObject = await db.get(getLikesQuery);
    const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;
    `;
    const repliesObject = await db.get(getRepliesQuery);
    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  }
});

// /tweets/:tweetId/likes/ API 7
app.get("/tweets/:tweetId/likes/", verifyToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUser = `
    select * from user where username = "${username}"
  `;
  const dbUser = await db.get(getUser);
  const getTweetQuery = `
    select * from tweet where tweet_id = ${tweetId}
  `;
  const tweetInfo = await db.get(getTweetQuery);
  const followingQuery = `
    select following_user_id from follower
     where follower_user_id = ${dbUser.user_id}
  `;
  const followingUsersObjectsList = await db.all(followingQuery);
  const followingUsersList = followingUsersObjectsList.map((obj) => {
    return obj["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time } = tweetInfo;
    const getLikesQuery = `
        select user_id from like where tweet_id = ${tweet_id}
    `;
    const likedUserIdObjectsList = await db.all(getLikesQuery);
    const likedUserIdsList = likedUserIdObjectsList.map((obj) => {
      return obj.user_id;
    });
    const getLikedUsersQuery = `
      SELECT username FROM user 
      WHERE user_id IN (${likedUserIdsList});
      `;
    const likedUsersObjectsList = await db.all(getLikedUsersQuery);
    const likedUsersList = likedUsersObjectsList.map((object) => {
      return object.username;
    });
    //console.log(likedUsersList);
    response.send({ likes: likedUsersList });
  }
});

// /tweets/:tweetId/replies/ API 8
app.get("/tweets/:tweetId/replies/", verifyToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getUserQuery = `
        select * from user where username = "${username}"
    `;
  const dbUser = await db.get(getUserQuery);
  const tweetsQuery = `select * from tweet where tweet_id = ${tweetId}`;
  const tweetInfo = await db.get(tweetsQuery);
  const followingUsersQuery = `
    select following_user_id from follower 
    where follower_user_id = ${dbUser.user_id}
  `;
  const followingUsersObjectsList = await db.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time } = tweetInfo;
    const getUserRepliesQuery = `
        select user.name AS name , reply.reply AS reply
        from reply INNER JOIN user ON reply.user_id =  user.user_id
        WHERE reply.tweet_id = ${tweet_id}
        `;
    const userRepliesObject = await db.all(getUserRepliesQuery);

    response.send({ replies: userRepliesObject });
  }
});

// /user/tweets/ API 9
app.get("/user/tweets/", verifyToken, async (request, response) => {
  const { username } = request;
  const getUserQuery = `
        select * from user where username = "${username}"
      `;
  const dbUser = await db.get(getUserQuery);
  const { user_id } = dbUser;
  const getTweetsQuery = `
    select * from tweet where user_id = ${user_id}
    order by tweet_id
  `;
  const tweetObjectsList = await db.all(getTweetsQuery);
  const tweetIdsList = tweetObjectsList.map((obj) => {
    return obj.tweet_id;
  });
  const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const likesObjectsList = await db.all(getLikesQuery);
  const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const repliesObjectsList = await db.all(getRepliesQuery);
  response.send(
    tweetObjectsList.map((tweetObj, index) => {
      const likes = likesObjectsList[index] ? likesObjectsList[index].likes : 0;
      const replies = repliesObjectsList[index]
        ? repliesObjectsList[index].replies
        : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

// /user/tweets/ API 10
app.post("/user/tweets/", verifyToken, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const { user_id } = dbUser;
  const { tweet } = request.body;
  const dateString = new Date().toISOString();
  const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);
  const addNewTweetQuery = `
  INSERT INTO tweet (tweet, user_id, date_time) 
  VALUES ('${tweet}', ${user_id}, '${dateTime}');
  `;
  const updatedTweet = await db.run(addNewTweetQuery);
  response.send("Created a Tweet");
});

// /tweets/:tweetId/ API 11
app.delete("/tweets/:tweetId/", verifyToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
  const tweetInfo = await db.get(getTweetQuery);
  if (dbUser.user_id !== tweetInfo.user_id) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteTweetQuery = `
      DELETE FROM tweet WHERE tweet_id = ${tweetId};
      `;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
