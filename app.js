const express = require('express');
const bodyParser = require('body-parser');
const app = express()
const path = require("path"); 
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
let mysql = require('mysql');
const morgan = require('morgan');
const http = require('http');
const https = require('https');
const fs = require('fs');
const async = require('async');


//middleware for bodyparse
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())

//middleware for EJS view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'));

app.use(morgan(":method :url :status :res[content-length] - :response-time ms"))

//middleware for creating user sessions
const options = {
    host: '54.245.149.137',
    user: 'server',
    password: 'keyboardPass1.',
    database: 'keyboardApp'
};

const db = mysql.createPool(options);
const sessionStore = new MySQLStore({}, db);
app.use(session({
        secret: '1234',
        resave: false,
        saveUninitialized: false,
        store: sessionStore
    })
);


//creates authorization requirement to access page
const isAuth = (req, res, next) => {
    if(req.session.isAuth) {
        next()
    }
    else {
        res.redirect("/login")
    }
};

app.get('/',(req, res) => {
    res.redirect('/login')
})


app.get('/register', (req, res) => {
    res.render('register');
})


app.get('/dashboard', isAuth, (req, res) => {
    var passage = "a red cat sat on a mat the hat was big and fat a pen sat next to a rat the dog dug a hole in the grass a bat flew by at dusk a mug held hot tea a map showed the way a tag had a name a wag sign said welcome a red cat sat on a mat the hat was big and fat a pen sat next to a rat the dog dug a hole in the grass a bat flew by at dusk a mug held hot tea a map showed the way a tag had a name a wag sign said welcome a red cat sat on a mat the hat was big and fat a pen sat next to a rat the dog dug a hole in the grass a bat flew by at dusk a mug held hot tea a map showed the way a tag had a name a wag sign said welcome"
    //creates an array of all the words, but we need a dictionary where 1 = array of characters in word 
    var words = passage.split(" ")
    //need to figure our a way to create an object where words are in order and each have definition of their characters
    var characters = {}
    for(let i = 0 ; i < words.length; i++){
        characters[i] = words[i].split("")
    }
    const count = words.length
    res.render('dashboard', {passage : passage, count : count, characters : characters});
})

app.get('/friendslist', isAuth, async (req, res) => {
    var requestedUsernames = [];
    var count = 0; 
    let currentUsername = req.session.user;
    let user_id;
    let friendRequests;
    
    let friends = [];
    let friendsListNames = [];
    await getUserId(currentUsername);
    await getFriendRequests(user_id);

    for (let i = 0; i < friendRequests.length; i++){
        requestedUsernames[i] = await getUserNames(friendRequests[i].user_first_id);
    }

    let friendsList = await getFriendsList(user_id);

    for (let i = 0; i < friendsList.length; i++){
        if (friendsList[i].user_first_id == user_id) {
            friends[i] = friendsList[i].user_second_id;
        }
        else if (friendsList[i].user_second_id == user_id){
            friends[i] = friendsList[i].user_first_id;
        }
    }

    for (let i = 0; i < friends.length; i++){
        let name = await getUserNames(friends[i])
        let wins = await getWins(friends[i])
        friendsListNames.push({username: name, wins: wins})
    }
    

    console.log(friendsListNames)

    function getUserId(currentUsername){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT user_id FROM users WHERE username = ?',
                [currentUsername],
                function (err, result){
                    if (err){
                        reject(err);
                    } else {
                        resolve(user_id = result[0].user_id)
                    }
                }
            )
        })
    }


    function getFriendRequests(user_id){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT * FROM friends WHERE (user_second_id = ?) AND (type = ?);',
                [user_id, 'user12'],
                function(err, result){
                    if(err){
                        reject(err);
                    } else {
                        resolve(friendRequests = result);
                    }
                }
            )
        })
    }

    

    function getUserNames(friendRequests){
        return new Promise ((resolve, reject) => {
                db.query(
                    'SELECT username FROM users WHERE user_id = ?;',
                    [friendRequests],
                    function(err, result){
                        if(err){
                            reject (err)
                        } else {
                            resolve(result[0].username)
                        }
                    }
                )
            })
    }

    function getWins(user_id){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT wins FROM users WHERE user_id = ?',
                [user_id],
                function(err, result){
                    if(err){
                        reject(err)
                    } else {
                        console.log(result[0].wins)
                        resolve(result[0].wins)
                    }
                }
            )
        })
    }
    console.log(friendsList)
    count = requestedUsernames.length;
    friendListCount = friendsListNames.length
    res.render('friendslist', {requestedUsernames : requestedUsernames, count : count, friendsListNames : friendsListNames, friendListCount : friendListCount})
    console.log('pageloaded')
})

app.post('/sendfriendrequest', isAuth, (req, res) => {
    //Need to fine a way to get the current user's userID

    //1: norelation = not friends
    //2: friends = they are friends
    //3: user12 = user 1 sent user 2 a request
    //4: user21 = user 2 sent user 1 a request
    //5: user1!2 = user 1 has blocked user 2
    //6: user2!1 = user 2 has blocked user 1 
    let types = ['norelation', 'friends', 'user12', 'user21', 'user1!2', 'user2!1']

    //username for the currently logged in user. 
    let currentUsername = [req.session.user];
    
    //user input for the name of desired friend
    let friendRequestName = req.body.friendRequestName;

    //user ID numbers
    let currentUserId, friendRequestId;
    
    //Sending Friend Request
    db.query(
        'SELECT user_id FROM users WHERE username = ?;',
        [currentUsername],
        function (err, result) {
            if (err) throw err; 
            currentUserId = result[0].user_id;
            console.log("current user ID: " + currentUserId)
            db.query(
                'SELECT user_id FROM users WHERE username = ?;',
                [friendRequestName],
                function (err, result){
                    if (err) throw err;
                    if (result.length == 0){
                        console.log('user does not exist')
                    }
                    else if (result.length > 0) {
                        friendRequestId = result[0].user_id;
                        console.log("friend user ID: " + friendRequestId)
                        db.query(
                            'SELECT type FROM friends WHERE user_second_id = ? AND user_first_id = ? OR user_first_id = ? AND user_second_id = ?;', 
                            [[currentUserId], [friendRequestId], [currentUserId],[friendRequestId]],
                            function (err, result, field){
                                if (err) throw err;
                                if (result.length == 0){
                                    console.log("doesnt exist")
                                    //Procedure of adding new relationship data to the friends database table
                                    db.query(
                                        'INSERT INTO friends VALUES (?);',
                                        [[currentUserId, friendRequestId, 'user12']]
                                    )
                                }
                                else if (result.length > 0){
                                    let friendType = result[0].type;
                                    if (friendType == 'friends'){
                                        console.log('Already Friends')
                                    }
                                    else if(friendType == 'user12' || friendType == 'user21'){
                                        console.log('Pending Friend Request')
                                    }
                                    else if (friendType == 'norelation'){
                                        console.log('No longer friends')
                                    }
                                }
                            }
                        )
                    }
                }
            )
        }
    )
           
    //db.query(
        //'SELECT * FROM friends WHERE user_first_id OR user_second_id = ?', [22], function(err, result, fields){
            //if (err) throw err;
            //let x = [];
            //for (let i = 0; i < result.length; i++){
                //x[i] = result[i].type;
            //}
            //console.log(x);
        //}
    //)
    res.redirect('/friendslist')
})

app.post('/friendslist/acceptFriendRequest', async (req,res) => {
    const username = [req.body.username, req.session.user];
    console.log(username);
    let user_id = [];
    for (let i = 0; i < username.length; i++){
        user_id[i] = await getUserId(username[i]);
    }
    await update(user_id);

    function getUserId(username){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT user_id FROM users WHERE username = ?',
                [username],
                function(err, result){
                    if(err){
                        reject(err);
                    } else {
                        resolve(result[0].user_id)
                    }
                }
            )
        })
    };

    function update(user_id){
        return new Promise ((resolve, reject) => {
            db.query(
                'UPDATE friends SET type = ? WHERE (user_first_id = ? AND user_second_id = ?)',
                ['friends', user_id[0], user_id[1]],
                function (err) {
                    if (err){
                        reject(err);
                    } else {
                        console.log('updated')
                        resolve();
                    }
                }
            )
        })
    }
    console.log(user_id[0], user_id[1])
    res.redirect('/friendslist')
    console.log('refreshing page')
})

app.post('/friendslist/deleteFriend', async (req, res) => {
    const username = [req.body.username, req.session.user];
    console.log(username[0]);
    let user_id = [];

    for (let i = 0; i < username.length; i++){
        user_id[i] = await getUserId(username[i]);
    }
    await update(user_id);


    function getUserId(username){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT user_id FROM users WHERE username = ?',
                [username],
                function(err, result){
                    if(err){
                        reject(err);
                    } else {
                        resolve(result[0].user_id)
                    }
                }
            )
        })
    };
    function update(user_id){
        return new Promise ((resolve, reject) => {
            db.query(
                'DELETE FROM friends WHERE (user_first_id = ? AND user_second_id = ?) OR (user_first_id = ? AND user_second_id = ?)',
                [user_id[0], user_id[1], user_id[1], user_id[0]],
                function (err) {
                    if (err){
                        reject(err);
                    } else {
                        console.log('updated')
                        resolve();
                    }
                }
            )
        })
    }

})

app.post('/friendslist/rejectFriendRequest', async (req,res) => {
    const username = [req.body.username, req.session.user];
    console.log(username);
    let user_id = [];
    for (let i = 0; i < username.length; i++){
        user_id[i] = await getUserId(username[i]);
    }
    await deleteRequest(user_id);

    function getUserId(username){
        return new Promise ((resolve, reject) => {
            db.query(
                'SELECT user_id FROM users WHERE username = ?',
                [username],
                function(err, result){
                    if(err){
                        reject(err);
                    } else {
                        resolve(result[0].user_id)
                    }
                }
            )
        })
    };

    function deleteRequest(user_id){
        return new Promise ((resolve, reject) => {
            db.query(
                'DELETE FROM friends WHERE (user_first_id = ? AND user_second_id = ?)',
                [user_id[0], user_id[1]],
                function(err, result){
                    if(err){
                        reject(err)
                    } else {
                        console.log('deleted')
                        resolve();
                    }
                }
            )
        })
    }
    console.log(user_id[0], user_id[1])
    res.redirect('/friendslist')
    console.log('refreshing page')
})

app.post('/dailyTrial', async (req, res) => {
    let username = req.session.user;
    let user_id = req.session.user_id;
    await updateDailyTrial(user_id);
    console.log(username)
    console.log(user_id)
})

app.post('/updateWPM', async (req, res) => {
    let right = req.body.right;
    let user_id = req.session.user_id;
    await updateWPM(user_id, right);
})

app.get('/leaderboard', async (req, res) => {
    let user_id = req.session.user_id;
    let friends = []
    let friendsData = [];
    let friendsList = await getFriendsList(user_id);
    for (let i = 0; i < friendsList.length; i++){
        if (friendsList[i].user_first_id == user_id) {
            friends[i] = friendsList[i].user_second_id;
        }
        else if (friendsList[i].user_second_id == user_id){
            friends[i] = friendsList[i].user_first_id;
        }
    }

    friends.push(user_id)

    for (let i = 0; i < friends.length; i++){
        let result = await getUserData(friends[i])
        friendsData.push({result : result})
    }


    friendsData.sort(function(a, b) {
        return b.result[0].wpm - a.result[0].wpm;
    });
    res.render('leaderboard', {friendsData : friendsData})
})

app.get('/group', async (req, res) => {
    let user_id = req.session.user_id;
    let userData = await getUserData(user_id);
    let groupMembers = await getGroupMembers(userData[0].GroupName);
    let groupMemberId = [];
    let groupMemberData = [];
    if (userData[0].GroupName == 'No Group'){
        res.render('group', {userData : userData, groupMemberData : groupMemberData})
    } else {
        for (let i = 0; i < groupMembers.length; i++){
            groupMemberId[i] = groupMembers[i].user_id
        }
        for (let i = 0; i < groupMemberId.length; i++){
            let result = await getUserData(groupMemberId[i])
            groupMemberData.push({result : result})
        }
        groupMemberData.sort(function(a, b) {
            return b.result[0].wpm - a.result[0].wpm;
        });
        res.render('group', {userData : userData, groupMemberData : groupMemberData})
    }   
})

app.post('/addGroup', async (req, res) => {
    let user_id = req.session.user_id;
    let groupName = req.body.groupName

    let result = await checkGroupName(groupName);

    if (result.length > 0){
        res.redirect('/group')
    } else {
        console.log(result.length);
        let userData = await getUserData(user_id)
        if (userData[0].GroupName == 'No Group'){
            let groupStatus = 0;
            await insertGroup(user_id, groupName)
            res.redirect('/group')
        } else {
            let groupStatus = 1;
            res.redirect('/group');
        }
    }
})

app.post('/joinGroup', async (req, res) => {
    let user_id = req.session.user_id;
    let groupName = req.body.groupName1;

    let result = await checkGroupName(groupName);
    console.log(result.length)
    if (result.length == 0){
        res.redirect('/group')
    } else {
        await insertGroup(user_id, groupName)
        res.redirect('/group')
    }
})

app.post('/leaveGroup', async (req, res) => {
    let user_id = req.session.user_id;
    await leaveGroup(user_id)
    function leaveGroup(user_id){
        return new Promise ((resolve, reject) => {
          db.query(
            'UPDATE users SET GroupName = ? WHERE user_id = ?',
            ['No Group', user_id],
            function (err){
                if (err){
                    reject(err)
                } else {
                    resolve()
                    }
                }
            )
        })
    }
    res.redirect('/group');
})
//renders login page
app.get('/login', (req, res) => {
    res.render('login')
})

//logout by destorying session 
app.post('/logout', (req,res) => {
    req.session.destroy((err) => {
        if(err) throw err;
        res.redirect('/');
    })
})


const userRouter = require('./routes/users.js');
const { count } = require('console');
const { devNull } = require('os');
const { callbackify } = require('util');
const e = require('express');
const { rejects } = require('assert');
const { request } = require('express');
const { waitForDebugger } = require('inspector');
const { all } = require('./routes/users.js');
const { promiseImpl } = require('ejs');
app.use('/users', userRouter)


function updateDailyTrial(user_id){
    return new Promise((resolve, reject) => {
        db.query(
            'UPDATE users SET DailyTrial = 1 WHERE user_id = ?',
            [user_id],
            function(err){
                if(err){
                    reject(err);
                } else {
                    resolve();
                }
            }
        )
    })
}

function updateWPM(user_id, right){
    return new Promise ((resolve, reject) => {
        db.query(
            'UPDATE users SET wpm = ? WHERE user_id = ?',
            [right, user_id],
            function(err){
                if (err) {
                    reject(err)
                } else {
                    console.log('updated wpm in database')
                    resolve();
                }
            }
        )
    })
}

function getFriendsList(user_id){
    return new Promise ((resolve, reject) => {
        db.query(
            'SELECT * FROM friends WHERE (user_first_id = ? OR user_second_id = ?) AND (type = ?);',
            [[user_id], [user_id], 'friends'],
            function(err, result){
                if(err){
                    reject(err)
                } else {
                    resolve(result)
                }
            }
        )
    })
}

function getUserData(user_id){
    return new Promise ((resolve, reject) => {
        db.query(
            'SELECT * FROM users WHERE user_id = ?',
            [user_id],
            function(err, result){
                if(err){
                    reject(err)
                } else {
                    resolve(result);
                }
            }
        )
    })
}

function insertGroup(user_id, groupName){
    return new Promise ((resolve, reject) => {
        db.query(
            'UPDATE users SET GroupName = ? WHERE user_id = ?',
            [groupName, user_id],
            function(err){
                if (err){
                    reject(err);
                } else {
                    resolve();
                }
            }
        )
    })
}

function checkGroupName(groupName){
    return new Promise ((resolve, reject) => {
        db.query(
            'SELECT GroupName FROM users WHERE GroupName = ?',
            [groupName],
            function (err, result){
                if (err){
                    reject(err)
                } else {
                    resolve(result)
                }
            }
        )
    })
}

function getGroupMembers(groupName){
    return new Promise ((resolve, reject) => {
        db.query(
            'SELECT user_id FROM users WHERE GroupName = ?',
            [groupName],
            function(err, result){
                if(err){
                    reject(err);
                } else {
                    resolve(result);
                }
            }
        )
    })
}
const port = process.env.port || 8080;
app.listen(port, () => {
    console.log(`server is running on localhost:${port}`);
})

