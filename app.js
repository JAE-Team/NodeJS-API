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
  res.writeHead(200, { 'Content-Type': 'application/json' });

  let receivedPost = await post.getPostObject(req);
  if((await queryDatabase("SELECT * FROM users WHERE sessionToken='" + receivedPost.sessionToken + "';")).length > 0){
    var results = await queryDatabase("SELECT * FROM users WHERE sessionToken='" + receivedPost.sessionToken + "';");
    console.log(results);
    res.end(JSON.stringify({"status":"OK","message":results}));
  } else {
    console.log(receivedPost.sessionToken);
    res.end(JSON.stringify({"status":"Error","message":"Failed to get the profile"}));
  }
}

/* Para cargar las transacciones de un usuario
A este post hay que pasarle la id-telefono de un usuario y nos debe devolver
un json con todas las transaciones
cada transaccion deberia ser un json, para poderse leer mas facilmente en la app de escritorio */
app.post('/api/get_transactions',getTransactions)
async function getTransactions (req, res) {
  let receivedPost = await post.getPostObject(req);
  console.log(receivedPost);
  try{
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // var resultName = await queryDatabase("SELECT userName, userSurname FROM USERS WHERE userId="+receivedPost.userId+";");
    // var results= await queryDatabase("SELECT DISTINCT t.*, u.userName FROM transactions t INNER JOIN users u ON t.userDestiny = u.userId OR t.userOrigin = u.userId WHERE userDestiny="+receivedPost.userId+" OR userOrigin="+receivedPost.userId+";");
    var results= await queryDatabase("SELECT transactions.*, usersO.userName AS originName, usersD.userName AS destinyName"
    +", usersO.userSurname AS originSurname,  usersD.userSurname AS destinySurname"
    +" FROM transactions"
    +" LEFT JOIN users AS usersO ON transactions.userOrigin = usersO.userId"
    +" LEFT JOIN users AS usersD ON transactions.userDestiny = usersD.userId"
    +" WHERE (userOrigin = "+receivedPost.userId+" OR userDestiny = "+receivedPost.userId+");");
    res.end(JSON.stringify({"status":"OK","message":results}));
  }catch(e){
    console.log("ERROR: " + e.stack)
    res.end(JSON.stringify({"status":"Error","message":"Failed to get the transactions"}));
  }
}

/* Parte de la spec 7, el usuario se logea y vamos a comprovar si ya existe, 
de no ser asi lo añadimos a la BBDD */
app.post('/api/signup',signup)
async function signup (req, res) {
  try {

    /* La respuesta sera un post que ademas del status, nos dara un mensaje informativo 
     Creo que aparte del mensaje, quizas tener una variable booleana que indique si la acción
      se ha hecho o no sea mas sencillo que trabajar directamente con el mensaje */
    let receivedPost = await post.getPostObject(req);
    let message;
    let token = "ST-" + uuidv4();
    let response={}
    // let done = false;

    let phone = receivedPost.userId;
    let password = receivedPost.userPassword;
    let email = receivedPost.userEmail;
    let name = receivedPost.userName;
    let surname = receivedPost.userSurname;
    let balance = receivedPost.userBalance;

    /* De momento no pasaremos la contraseña por el post */

    let phoneSearch = await queryDatabase("SELECT * FROM users WHERE userId='" + phone + "';");

    /* Si en la query encuentra algo, significa que ese num de telefono ya esta registrado */
    if (phoneSearch.length > 0) {
      response["status"]="KO";
      response["message"]="Usuari ja existeix";
      balance = await queryDatabase("SELECT userBalance FROM users WHERE userId='" + phone + "';");
      await queryDatabase("UPDATE users SET userName='" + name + "', userSurname='" + surname + "' , userEmail='" + email + "', userBalance=" + balance + " WHERE userId='" + phone + "';");

    } else if ((await queryDatabase("SELECT * FROM users WHERE userEmail='" + email + "';")).length == 1) {
      response["status"]="KO";
      response["message"]="Email ja existeix";
      
    } else if (phone.toString().length < 9) {
      response["status"]="KO";
      response["message"] = "Format incorrecte de teléfon";
      
    } else if (!checkEmail(email)) {
      response["status"]="KO";
      response["message"] = "Format incorrecte de correu";
      
    } else {
      queryDatabase("INSERT INTO users (userId, userPassword, userName, userSurname, userEmail, userBalance, sessionToken) VALUES ('"+phone+"','"+password+"', '"+name+"', '"+surname+"', '"+email+"', '"+balance+"', '"+token+"');");
      response["status"]="OK";
      response["message"] = "Usuari creat satisfactoriament";
      response["token"] = token;
    }

    res.end(JSON.stringify(response));
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
  if(userSearch.length==1 && userSearch[0].userPassword===receivedPost.userPassword){
    response["status"]="OK";
    response["message"]="Login correcte!";
    response["token"]=token;
    await queryDatabase ("UPDATE users SET sessionToken='"+token+"' WHERE userEmail='"+receivedPost.userEmail+"';");
  }else{
    response["status"]="Error";
    response["message"] = "No s'ha pogut iniciar sessió";
    if(userSearch.length==0){
      response["message"]+=", el email es incorrecte";
    }else if(userSearch[0].userPassword!=receivedPost.userPassword){
      response["message"]+=", la clau d'usuari es incorrecte";
    }
  }

  res.end(JSON.stringify(response));
}

app.post('/api/logout',logout)
async function logout (req, res) {

  let receivedPost = await post.getPostObject(req);
  let message

  let sessionToken = receivedPost.session_token;

  let sessionTokenSearch = queryDatabase("SELECT * FROM users WHERE sessionToken='" + sessionToken + "';");
  
  if (sessionTokenSearch.length != 0) {
    await queryDatabase ("UPDATE users SET sessionToken='' WHERE userId='"+receivedPost.userId+"';");
    message = "Logout correct";
  }else{
    message = "Logout failed, session token not found";
  }

  res.end(JSON.stringify({"status":"OK", "message":message}));

}

app.post('/api/send_id',logout)
async function logout (req, res) {

  let receivedPost = await post.getPostObject(req);
  let token = receivedPost.sessionToken;
  let anversDNI = receivedPost.anvers;
  let reversDNI = receivedPost.revers;
  let response = {};

  if (receivedPost.type == "uploadFile") {
    await queryDatabase("UPDATE users SET anvers='" + anversDNI + "', revers='" + reversDNI + "' WHERE sessionToken='" + token + "';")
    response["status"] = "OK";
    response["message"] = "Imatges pujades a la BDD";
  } else {
    response["status"] = "KO";
    response["message"] = "No s'han pogut pujar les imatges a la BDD";
  }
  
  res.end(JSON.stringify(response));
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
      message = "Usuari no existeix a la base de dades";
      /* En caso contrario, el usuario de id existe, vamos a comprobar si la cantidad 
       esta en un formato numerico y es mayor que 0 (no tiene sentido una transferencia negativa) */
    }else if(isValidNumber(amount)==false){
      message = "Wrong ammount, not a valid number";
    }else if(amount<=0){
      message = "Wrong ammount, must be greater than 0";
      /* Si se cumplen las condiciones, todo Ok, creamos token
       guardamos transferencia en BBDD, aun no esta acceptada, el pagador tendra que aceptar */
    }else{
      message = "Token de transacció generat";
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
      message = "Transacció no trobada";
      RESULT={"status":"Error","message":message}
      /* Comprobar que el token no sea de una transaccion ya aceptada (y por tanto finalizada) */
    }else if(resultQuery[0]["accepted"] != "waitingAcceptance"){
      message = "Transacció repetida, no pot ser acceptada";
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
    RESULT = {"status":"Error","message":"Transacció no pot ser completada"};
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
        message = "Transacció aceptada";
        console.log("si");
      }else{
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'insufficient balance'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
        message = "Transacció rebutjada, el usuari que está pagant no té suficient sou";
      }
    }else{
      queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'rejectedByUser'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
      message = "Transacció reutjada per l'usuari";
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

function checkEmail(str){
  var filter = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return filter.test(str);
}


// Perform a query to the database
function queryDatabase (query) {

  return new Promise((resolve, reject) => {
    var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "containers-us-west-167.railway.app",
      port: process.env.MYSQLPORT || 7210,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "j7YboDzy5yIdT6F8FRei",
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