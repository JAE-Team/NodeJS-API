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
app.post('/api/get_profiles',getProfiles)
async function getProfiles (req, res) {
  try{
    res.writeHead(200, { 'Content-Type': 'application/json' });
  var results= await queryDatabase("SELECT * FROM users;");
  res.end(JSON.stringify({"status":"OK","result":results}));
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

/* Parte de la spec 7, el usuario se logea y vamos a comprovar si ya existe, 
de no ser asi lo añadimos a la BBDD */
app.post('/api/signup',signup)
async function signup (req, res) {
  try{

    /* La respuesta sera un post que ademas del status, nos dara un mensaje informativo 
     Creo que aparte del mensaje, quizas tener una variable booleana que indique si la acción
      se ha hecho o no sea mas sencillo que trabajar directamente con el mensaje */
    let receivedPost = await post.getPostObject(req);
    let message;
    // let done = false;

    let email = receivedPost.email;
    let name = receivedPost.name;
    let surname = receivedPost.surname;
    let phone = receivedPost.phone;

    /* De momento no pasaremos la contraseña por el post */
    // let password = receivedPost.password;

    let phoneSearch = queryDatabase ("SELECT * FROM users WHERE userPhone='"+phone+"';");

    /* Si en la query encuentra algo, significa que ese num de telefono ya esta registrado */
    if(phoneSearch.length>0){
      message = "User already exists, new user can't be created";
      // done = false;
      /* En caso contrario, ese usuario no existe y lo crea */
    }else{
      // queryDatabase("INSERT INTO users (userEmail, userName, userSurname, userPhone, userPassword) VALUES ('"+email+"', '"+name+"', '"+surname+"', '"+phone+"', '"+password+"');");
      queryDatabase("INSERT INTO users (userEmail, userName, userSurname, userPhone) VALUES ('"+email+"', '"+name+"', '"+surname+"', '"+phone+"');");
      message = "User created correctly";
      // done = true;
    }

    res.end(JSON.stringify({"status":"OK", "message":message}));
    // res.end(JSON.stringify({"status":"OK", "message":message, "done":done}));
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

app.post('/api/login',login)
async function login (req, res) {
  let receivedPost = await post.getPostObject(req);
  let message;

  let email = receivedPost.email;
  let password;
  // let password = receivedPost.password;

  emailSearch = queryDatabase ("SELECT * FROM users WHERE userEmail='"+email+"';");
  passwordSearch = queryDatabase ("SELECT userPassword FROM users WHERE userEmail='"+password+"';");

  if(emailSearch.length==1 && passwordSearch.length==1){
    message = "Login correct, welcome!";
  }else{
    message = "Login failed";
    if(emailSearch.length==0){
      message = message +", the email is wrong";
    }
    if(passwordSearch.length==0){
      message = message +", the password is wrong";
    }
    
  }

  res.end(JSON.stringify({"status":"OK", "message":message, "transaction_token":token}));
}

app.post('/api/logout',logout)
async function logout (req, res) {

  let receivedPost = await post.getPostObject(req);
  let message

  let sessionToken = receivedPost.session_token;

  let sessionTokenSearch = queryDatabase ("SELECT * FROM sessions WHERE sessionToken='"+sessionToken+"';");
  if (sessionTokenSearch.length==0){
    message = "Logout failed, session token not found";
  }else{
    message = "Logout correct";
  }

  res.end(JSON.stringify({"status":"OK", "message":message}));

}

app.post('/api/setup_payment',setupPayment)
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
      /* En caso contrario, el usuario de id existe, vamos a comprobar si la cantidad 
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
      let now=new Date().toJSON().slice(0, 10)
      queryDatabase("INSERT INTO transactions (token, userDestiny,ammount, accepted, timeSetup) VALUES ('"+token +"', '"+ userIdDestination +"',"+amount+", 'waitingAcceptance', '"+ now +"')");
      //var results= await queryDatabase("SELECT * FROM users");
    }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({"status":"OK", "message":message, "transaction_token":token}));

  }catch(e){
    console.log("ERROR: " + e.stack)
  }

}

app.post('/api/start_payment', startPayment)
async function startPayment (req, res) {
  try{
    let receivedPost = await post.getPostObject(req);

    let token = receivedPost.transaction_token;
    let userIdOrigin = receivedPost.user_id;

    let message;
    let transactionType;

    let resultQuery = await queryDatabase("SELECT * FROM transactions WHERE token='"+token+"';");
    let status= resultQuery[0]["accepted"];
    if(resultQuery.length==0){
      message = "Transaction not found";
      /* Comprobar que el token no sea de una transaccion ya aceptada (y por tanto finalizada) */
    }else if(status != "waitingAcceptance"){
      message = "Transaction repeated, can't be accepted";
    }else{
      message = "Transaction done correctly";
    }
    let now=new Date().toJSON().slice(0, 10)
    /* Necesitamos tener las fechas de setupPayment, startPayment y finishPayment para llevar un registro de cuanto tiempo
    pasa entre cada parte de la transferencia */
    queryDatabase("UPDATE transactions SET timeStart ='"+ now +"' WHERE token ='"+ token+"';");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({"status":"OK", "message":message, "transaction_type":transactionType, "amount":resultQuery[0]["ammount"]}));
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

app.post('/api/finish_payment', getPayment)
async function getPayment (req, res) {
  try{
    let receivedPost = await post.getPostObject(req);

    let userId = receivedPost.user_id;
    let token = receivedPost.transaction_token;
    let accept = receivedPost.accept;
    let ammount = receivedPost.amount;
    
    let message;
    let balancePayer;

    /* Primero si la variable accept enviada a traves del post, booleana, es true, significa que el
    usuario que tiene que pagar da el OK a la transaccion */
    if(accept){
      balancePayer = queryDatabase ("SELECT userBalance FROM users WHERE userId='"+userId+"';");
      /*Comprobamos si el usuario tiene saldo suficiente para hacer la transferencia  */
      if(amount>=balancePayer){
        /* Registramos el resto de datos en la transferencia, 
        ya sea que es aceptada, denegada pro falta de dinero o por el mismo usuario */
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'acceptedByUser'"+ ", timeFinish ="+ Date("YYYY-MM-DD hh:mm:ss") +"WHERE token ='"+ token+"';");

        /* Actualizamos el balance del usuario que paga */
        queryDatabase("UPDATE users SET userBalance ="+ (balancePayer-amount) +"WHERE userId ='"+ userId+"';");
        
        /* Actualizamos el balance del usuario que recibe, primero debemos encontrar la id
        del usuario receptor a partir del token de la transferencia y su saldo,
        con esos datos lo actualizamos */
        let userReceptorId = queryDatabase ("SELECT userDestiny FROM transactions WHERE token='"+token+"';");
        let balanceReceptor = queryDatabase ("SELECT userBalance FROM users WHERE userId='"+userReceptorId+"';");

        queryDatabase("UPDATE users SET userBalance ="+ (balanceReceptor+amount) +"WHERE userId ='"+ userReceptorId+"';");
        message = "Transaction accepted";
      }else{
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'insufficient balance'"+ ", timeFinish ="+ Date("YYYY-MM-DD hh:mm:ss") +"WHERE token ='"+ token+"';");
        message = "Transaction rejected, the user who pays doesn't have enough money";
      }
    }else{
      queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'rejectedByUser'"+ ", timeFinish ="+ Date("YYYY-MM-DD hh:mm:ss") +"WHERE token ='"+ token+"';");
      message = "Transaction rejected by the user";
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({"status":"OK", "message":message}));

}catch(e){
  console.log("ERROR: " + e.stack)
}
}

function isValidNumber(number) {
  if(typeof number =="number"){
    return true;
  }else{
    return false
  }
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
      host: process.env.MYSQLHOST || "containers-us-west-138.railway.app",
      port: process.env.MYSQLPORT || 6412,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "CG52zkHZxyzOTU0FcYEl",
      database: process.env.MYSQLDATABASE || "railway"
    });

    /* Albert: Para hacer pruebas en local en mi PC */
/*     var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "localhost",
      port: process.env.MYSQLPORT || 3306,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "localhost",
      database: process.env.MYSQLDATABASE || "ieticorn_database"
    }); */

    connection.query(query, (error, results) => { 
      if (error) reject(error);
      resolve(results)
    });
     
    connection.end();
  })
}