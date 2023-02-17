const express = require('express')
const fs = require('fs/promises')
const url = require('url')
const mysql = require('mysql2')
const post = require('./post.js')
const { v4: uuidv4 } = require('uuid')

// Wait 'ms' milliseconds
function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Start HTTP server
const app = express()

// Set port number
const port = process.env.PORT || 3001

// Publish static files from 'public' folder
//app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, appListen)
function appListen () {
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
}
//Get profiles endpoint
app.post('/get_profiles',getProfiles)
async function getProfiles (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  var results= await queryDatabase("SELECT * FROM users;");
  res.end(JSON.stringify({"status":"OK","result":results}));
}

app.post('/setup_payment',setupPayment)
async function setupPayment (req, res) {
  try{
    /* Tenemos un post, de este post obtendremos el id de usuario y la cantidad */
    let receivedPost = await post.getPostObject(req);
    let userIdDestination = receivedPost.user_id;
    let amount = receivedPost.amount;
    var token;
    let message;

    /* Comprobamos que el id de usuario existe */
    let checkUserExists = queryDatabase ("SELECT * FROM users WHERE userId='"+userIdDestination+"';");
    if(checkUserExists.length==0){
      message = "User not found in the database";
      /* El usuario de id existe, vamos a comprobar si la cantidad 
       esta en un formato numerico y es mayor que 0 (no tiene sentido una transferencia negativa) */
    }else if(isValidNumber(amount)==false){
      message = "Wrong ammount, not a valid number";
    }else if(amount<=0){
      message = "Wrong ammount, must be greater than 0";
      /* Si se cumplen las condiciones, todo Ok, creamos token
       guardamos transferencia en BBDD, aun no esta acceptada, el pagador tendra que aceptar */
    }else{
      message = "Transaction correct";
      token = uuidv4();
      queryDatabase("INSERT INTO transactions (token, userDestiny, accepted, timeSetup) VALUES ('"+token +", "+ userIdDestination +", false, "+ Date("YYYY-MM-DD hh:mm:ss") +")");
      //var results= await queryDatabase("SELECT * FROM users");
    }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({"status":"OK", "message":message, "transaction_token":token}));

  }catch(e){
    console.log("ERROR: " + e.stack)
  }

}

app.post('/start_payment', startPayment)
async function startPayment (req, res) {
  try{
    let receivedPost = await post.getPostObject(req);

    let token = receivedPost.transaction_token;
    let userIdOrigin = receivedPost.user_id;

    let message;
    let transactionType;

    let resultQuery = await queryDatabase("SELECT * FROM transactions WHERE token='"+token+"';");
    let isAccepted = await queryDatabase("SELECT accepted FROM transactions WHERE token='"+token+"';");
    if(resultQuery.length=0){
      message = "Transaction not found";
      /* Comprobar si el token no sea de una transaccion ya aceptada (y por tanto finalizada) */
    }else if(isAccepted[0].accepted != 'waitingAcceptance'){
      message = "Transaction repeated, can't be accepted";
    }else{
      message = "Transaction done correctly";
    }

    /* Necesitamos tener las fechas de setupPayment, startPayment y finisPayment para llevar un registro de cuanto tiempo
    pasa entre cada parte de la transferencia */
    queryDatabase("UPDATE transactions SET timeStart ="+ Date("YYYY-MM-DD hh:mm:ss") +"WHERE token ='"+ token+"';");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({"status":"OK", "message":message, "transaction_type":transactionType, "amount":amount}));
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

app.post('/finish_payment', getPayment)
async function getPayment (req, res) {
  try{
    let receivedPost = await post.getPostObject(req);

    let userId = receivedPost.user_id;
    let token = receivedPost.transaction_token;
    let accept = receivedPost.accept;
    let ammount = receivedPost.amount;
    
    let message;

    if(accept){
      if(amount>100){
        queryDatabase("UPDATE transactions SET userDestiny ="+ userId +", ammount ="+ ammount +", accepted = "+ accepted+ ", timeFinish ="+ Date("YYYY-MM-DD hh:mm:ss") +"WHERE token ='"+ token+"';");
        message = "Transaction accepted";
      }else{
        message = "Transaction rejected, the amount is not enough";
      }
    }else{
      message = "Transaction rejected by the user";
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({"status":"OK", "message":message}));

}catch(e){
  console.log("ERROR: " + e.stack)
}
}

function isValidNumber(str) {
  // Check if the string contains only digits, optional minus sign, and optional decimal separator
  const regex = /^-?\d+(\.\d+)?$/;
  
  // Check if the string matches the regex and is not empty
  if (str && str.match(regex)) {
    // Check if the decimal separator is correct (if present)
    const decimalSeparator = (1.1).toLocaleString().replace(/\d/g, '');
    return str.indexOf(decimalSeparator) === -1 || str.indexOf(decimalSeparator) === str.lastIndexOf(decimalSeparator);
  }
  return false;
}
/* console.log(isValidNumber("135"));
console.log(isValidNumber("45.678"));
console.log(isValidNumber("12,34"));
console.log(isValidNumber("errr"));
console.log(isValidNumber("df.h"));
console.log(isValidNumber("123.4.5")); */

// Perform a query to the database
function queryDatabase (query) {

  return new Promise((resolve, reject) => {
    var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "localhost",
      port: process.env.MYSQLPORT || 3306,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "Persiana@1234",
      database: process.env.MYSQLDATABASE || "proyecto"
    });

    connection.query(query, (error, results) => { 
      if (error) reject(error);
      resolve(results)
    });
     
    connection.end();
  })
}