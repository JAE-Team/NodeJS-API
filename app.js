const express = require('express')
const fs = require('fs/promises')
const url = require('url')
const mysql = require('mysql2')
const post = require('./post.js')
const { v4: uuidv4 } = require('uuid')
const { response } = require('express')

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
  res.end(JSON.stringify({"status":"OK","message":results}));
  }catch(e){
    console.log("ERROR: " + e.stack)
    res.end(JSON.stringify({"status":"Error","message":"Failed to get the profiles"}));
  }
}

//Get profiles endpoint
app.post('/api/get_profile',getProfile)
async function getProfile (req, res) {
  let receivedPost = await post.getPostObject(req);
  console.log(receivedPost);
  try{
    res.writeHead(200, { 'Content-Type': 'application/json' });
    var results= await queryDatabase("SELECT * FROM users WHERE userId="+receivedPost.userId+";");
    results[0]["transactions"]=await queryDatabase("SELECT * FROM transactions WHERE userDestiny="+receivedPost.userId+";");
    res.end(JSON.stringify({"status":"OK","message":results}));
  }catch(e){
    console.log("ERROR: " + e.stack)
    res.end(JSON.stringify({"status":"Error","message":"Failed to get the profile"}));
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
    let balance = receivedPost.balance;

    /* De momento no pasaremos la contraseña por el post */
    // let password = receivedPost.password;

    let phoneSearch = await queryDatabase ("SELECT * FROM users WHERE userId='"+phone+"';");

    /* Si en la query encuentra algo, significa que ese num de telefono ya esta registrado */
    if(phoneSearch.length>0){
      message = "User already exists";
      balance = await queryDatabase ("SELECT userBalance FROM users WHERE userId='"+phone+"';");
      await queryDatabase("UPDATE users SET userName='"+ name + "', userSurname='" + surname + "' , userEmail='" + email + "', userBalance='"+balance+"' WHERE userId='"+phone+"';");
    }else{
      // queryDatabase("INSERT INTO users (userEmail, userName, userSurname, userPhone, userPassword) VALUES ('"+email+"', '"+name+"', '"+surname+"', '"+phone+"', '"+password+"');");
      queryDatabase("INSERT INTO users (userId, userName, userSurname, userEmail, userBalance) VALUES ('"+phone+"', '"+name+"', '"+surname+"', '"+email+"', '"+balance+"');");
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
  let token = "ST-"+uuidv4();
  let response={}
  // let password = receivedPost.password;
  let userSearch = await queryDatabase ("SELECT * FROM users WHERE userEmail='"+receivedPost.userEmail+"';");
  //passwordSearch = queryDatabase ("SELECT userPassword FROM users WHERE userEmail='"+password+"';");
  if(userSearch.length==1){
    response["status"]="OK";
    response["message"]="Login correct, welcome!";
    response["token"]=token;
    await queryDatabase ("UPDATE users SET sessionToken='"+token+"' WHERE userEmail='"+receivedPost.userEmail+"';");
  }else{
    response["status"]="Error";
    response["message"] = "Login failed";
    if(userSearch.length==0){
      response["message"]+=", the email is wrong";
    }
  }

  res.end(JSON.stringify(response));
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
      token = "P-"+uuidv4();
      let now=getDate();
      console.log(now)
      queryDatabase("INSERT INTO transactions (token, userDestiny,ammount, accepted) VALUES ('"+token +"', '"+ userIdDestination +"',"+amount+", 'waitingAcceptance')");
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
    const TOKEN = receivedPost.transaction_token;
    let RESULT = {};
    //let userIdOrigin = receivedPost.user_id; FUTURE IMPLEMENTATION
    let resultQuery = await queryDatabase("SELECT * FROM transactions WHERE token='"+TOKEN+"';");

    if(resultQuery.length==0){
      message = "Transaction not found";
      RESULT={"status":"Error","message":message}
      /* Comprobar que el token no sea de una transaccion ya aceptada (y por tanto finalizada) */
    }else if(resultQuery[0]["accepted"] != "waitingAcceptance"){
      message = "Transaction repeated, can't be accepted";
      RESULT = {"status":"Error","message":message};
    }else{
      message = "Transaction done correctly";
      RESULT={"status":"OK","message":message,"transaction_type":"Payment","amount":resultQuery[0]["ammount"]};
    }
    /* Necesitamos tener las fechas de setupPayment, startPayment y finishPayment para llevar un registro de cuanto tiempo
    pasa entre cada parte de la transferencia */
    queryDatabase("UPDATE transactions SET timeStart = NOW() WHERE token ='"+ TOKEN +"';");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(RESULT));
  }catch(e){
    console.log("ERROR: " + e.stack)
    RESULT = {"status":"Error","message":"Transaction cannot be completed"};
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(RESULT));
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
    await queryDatabase("SET autocommit = 0;");
    /* Primero si la variable accept enviada a traves del post, booleana, es true, significa que el
    usuario que tiene que pagar da el OK a la transaccion */
    if(accept){
      balancePayer = await queryDatabase ("SELECT userBalance FROM users WHERE userId='"+userId+"';");
      console.log(balancePayer[0].userBalance)
      /*Comprobamos si el usuario tiene saldo suficiente para hacer la transferencia  */
      if(ammount<=balancePayer[0].userBalance){
        /* Registramos el resto de datos en la transferencia, 
        ya sea que es aceptada, denegada pro falta de dinero o por el mismo usuario */
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'acceptedByUser'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");

        /* Actualizamos el balance del usuario que paga */
        queryDatabase("UPDATE users SET userBalance ="+ (balancePayer[0].userBalance-ammount) +" WHERE userId ='"+ userId+"';");
        
        /* Actualizamos el balance del usuario que recibe, primero debemos encontrar la id
        del usuario receptor a partir del token de la transferencia y su saldo,
        con esos datos lo actualizamos */
        let userReceptorId = await queryDatabase ("SELECT userDestiny FROM transactions WHERE token='"+token+"';");
        console.log("SELECT userBalance FROM users WHERE userId='"+userReceptorId[0].userDestiny+"';");
        let balanceReceptor = await queryDatabase ("SELECT userBalance FROM users WHERE userId='"+userReceptorId[0].userDestiny+"';");
        console.log(balanceReceptor);
        queryDatabase("UPDATE users SET userBalance ="+ (balanceReceptor[0].userBalance+ammount) +" WHERE userId ='"+ userReceptorId[0].userDestiny+"';");
        message = "Transaction accepted";
        console.log("si");
      }else{
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'insufficient balance'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
        message = "Transaction rejected, the user who pays doesn't have enough money";
      }
    }else{
      queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'rejectedByUser'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
      message = "Transaction rejected by the user";
    }
    await queryDatabase("COMMIT;");
    await queryDatabase("SET autocommit = 1;");
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

function getDate(){
  var now = new Date();
  var formatedDate = now.getFullYear()+"/"+now.getMonth()+"/"+now.getDay()+" ";
  formatedDate += now.getHours()+":"+now.getMinutes()+":"+now.getSeconds();
  return formatedDate;
}

// Perform a query to the database
function queryDatabase (query) {

  return new Promise((resolve, reject) => {
    var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "containers-us-west-126.railway.app",
      port: process.env.MYSQLPORT || 7100,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "cPQE4SjhyzwlJJPi9rP2",
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