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
  var results= await queryDatabase("SELECT * FROM users");
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
    let checkUserExists = queryDatabase ("SELECT * FROM users WHERE userId='"+userIdDestination+"'");
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
      queryDatabase("INSERT INTO transactions (token, userDestiny, accepted) VALUES ('"+token +", "+ userIdDestination +", false)");
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

    let status;
    let message;
    let transactionType;
    let amount;

    let resultQuery = await queryDatabase("SELECT * FROM transactions WHERE token='"+token+"'");
    const isAccepted = await queryDatabase("SELECT accepted FROM transactions WHERE token='"+token+"'");
    if(resultQuery.length=0){
      message = "Transaction not found";
      /* Comprobar si el token es de una transaccion ya aceptada (y por tanto finalizada)
      Este codigo hay que testearlo */
    }else if(isAccepted[0].accepted){
      message = "Transaction already accepted";
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

app.post('/finish_payment', getPayment)
async function getPayment (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  let results;
  res.end(JSON.stringify({"status":"OK","result":results}));
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