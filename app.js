const express = require('express')
const fs = require('fs/promises')
const url = require('url')
const mysql = require('mysql2')
const post = require('./post.js')
const { v4: uuidv4 } = require('uuid')
const { response } = require('express')
const { stat } = require('fs')

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
  let receivedPost = await post.getPostObject(req);
  let filters="";
  try{
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if("filterBalance" in receivedPost){
      let range = receivedPost.filterBalance.split(";");
      filters+=" userBalance BETWEEN "+range[0]+" AND "+range[1];
      console.log(filters)
    }if("filterStatus" in receivedPost){
      filters+= filters!="" ? " AND" : "";
      filters+=" verificationStatus='"+receivedPost.filterStatus+"'";
    }if("filterTransactions" in receivedPost){
      filters+= filters!="" ? " AND" : "";
      let range = receivedPost.filterTransactions.split(";");
      filters+=" userId IN (SELECT userId FROM users JOIN transactions ON users.userId = transactions.userOrigin OR users.userId = transactions.userDestiny ";
      filters+="GROUP BY userId HAVING COUNT(*) >= "+range[0]+" AND COUNT(*) <= "+range[1]+");"
    }
    if(filters!=""){
      var results= await queryDatabase("SELECT id, userId, userPassword, userName, userSurname, \
                                        userEmail, userBalance, userStatus, lastStatusChange,\
                                        sessionToken, verificationStatus FROM users WHERE"+filters+";");
    }else{
      var results= await queryDatabase("SELECT id, userId, userPassword, userName, userSurname,\
                                         userEmail, userBalance, userStatus, lastStatusChange,\
                                          sessionToken, verificationStatus FROM users;");
    }
    if(results.length==0){
      res.end(JSON.stringify({"status":"Error","message":"No s'ha trobat cap usuari"}));
    }else{
      res.end(JSON.stringify({"status":"OK","message":results}));
    }
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
  let query;
  if(receivedPost.returnDNI){
    query = "SELECT *";
  }else{
    query = "SELECT id, userId, userPassword, userName, userSurname,\
              userEmail, userBalance, userStatus, lastStatusChange,\
              sessionToken, verificationStatus";
  }
  query+=" FROM users WHERE sessionToken='" + receivedPost.sessionToken + "';";
  if((await queryDatabase(query)).length > 0){
    var results = await queryDatabase(query);
    console.log(results);
    res.end(JSON.stringify({"status":"OK","message":results}));
  } else {
    console.log(receivedPost.sessionToken);
    res.end(JSON.stringify({"status":"Error","message":"Failed to get the profile"}));
  }
}

app.post('/api/get_userDNI',getDNI)
async function getDNI (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });

  let receivedPost = await post.getPostObject(req);
  if((await queryDatabase("SELECT anvers,revers FROM users WHERE id='" + receivedPost.user_id + "';")).length > 0){
    var results = await queryDatabase("SELECT anvers,revers FROM users WHERE id='" + receivedPost.user_id + "';");
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
    await queryDatabase("SET autocommit = 0;");

    let receivedPost = await post.getPostObject(req);
    let message;
    let token = await generateToken();
    let response={}
    let tokenPay = "P-"+uuidv4();
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
      queryDatabase("INSERT INTO transactions (token, userDestiny,ammount, accepted) VALUES ('"+tokenPay +"', '"+ phone +"','CORNSERVICE',"+amount+", 'waitingAcceptance')");
      queryDatabase("INSERT INTO users (userId, userPassword, userName, userSurname, userEmail, userBalance, sessionToken) VALUES ('"+phone+"','"+password+"', '"+name+"', '"+surname+"', '"+email+"', '"+balance+"', '"+token+"');");
      response["status"]="OK";
      response["message"] = "Usuari creat satisfactoriament";
      response["token"] = token;
    }
    await queryDatabase("COMMIT;");
    await queryDatabase("SET autocommit = 1;");

    res.end(JSON.stringify(response));
  }catch(e){
    console.log("ERROR: " + e.stack)
  }
}

app.post('/api/login',login)
async function login (req, res) {
  let receivedPost = await post.getPostObject(req);
  let token = await generateToken();
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

app.post('/api/send_id',sendID)
async function sendID (req, res) {

  let receivedPost = await post.getPostObject(req);
  let sessionToken = receivedPost.sessionToken;
  let anversDNI = receivedPost.anvers;
  let reversDNI = receivedPost.revers;
  let response = {};

  if (receivedPost.type == "uploadFile") {
    await queryDatabase("UPDATE users SET anvers='" + anversDNI + "', revers='" + reversDNI + "', verificationStatus='WAITING_VERIFICATION' WHERE sessionToken='" + sessionToken + "';")
    response["status"] = "OK";
    response["message"] = "Imatges pujades satisfactoriament";
    response["statusDNI"] = "WAITING_VERIFICATION";
  } else {
    response["status"] = "KO";
    response["message"] = "No s'han pogut pujar les imatges a la BDD";
  }
  
  res.end(JSON.stringify(response));
}

app.post('/api/make_verification',makeVerification)
async function makeVerification (req, res) {

  let receivedPost = await post.getPostObject(req);
  let id = receivedPost.user_id;
  let statusVerification = receivedPost.status;
  let response = {};

  if ((await queryDatabase("SELECT * FROM users WHERE id="+ id +";")).length > 0) {
    switch (statusVerification) {
      case "accepted":
        await queryDatabase("UPDATE users SET verificationStatus='ACCEPTED' WHERE id=" + id + ";")
        response["status"] = "OK";
        response["message"] = "Usuari accceptat";
        break;

      case "rejected":
        await queryDatabase("UPDATE users SET verificationStatus='REJECTED' WHERE id=" + id + ";")
        response["status"] = "OK";
        response["message"] = "Usuari rebutjat";
        break;
    
      default:
        break;
    }
    
  } else {
    response["status"] = "KO";
    response["message"] = "No s'ha pogut fer la verificació";
  }
  
  res.end(JSON.stringify(response));
}

app.post('/api/setup_payment',setupPayment)
async function setupPayment (req, res) {
  try{
    /* Tenemos un post, de este post obtendremos el id de usuario y la cantidad */
    let receivedPost = await post.getPostObject(req);
    let userToken = receivedPost.destUToken;
    let amount = receivedPost.amount;
    let message;
    let token;

    /* Comprobamos que user correcponde el token */
    let userDest = await queryDatabase ("SELECT userId FROM users WHERE sessionToken='"+userToken+"';");
    if(userDest.length == 0){
      message = "No s'ha trobat el usuari destinatari";
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
      queryDatabase("INSERT INTO transactions (token, userDestiny,ammount, accepted) VALUES ('"+token +"', '"+ userDest[0].userId +"',"+amount+", 'waitingAcceptance')");
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
    let sourceToken = receivedPost.sourceUToken;
    let RESULT = {};
    //let userIdOrigin = receivedPost.user_id; FUTURE IMPLEMENTATION
    let sourceUser = await queryDatabase ("SELECT userId FROM users WHERE sessionToken='"+sourceToken+"';");
    if(sourceUser.length!=0){
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
      queryDatabase("UPDATE transactions SET timeStart = NOW(), userOrigin = '"+sourceUser[0].userId+"' WHERE token ='"+ TOKEN +"';");
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(RESULT));
    }else{
      message = "No s'ha trobat el usuari d'origen";
      RESULT = {"status":"Error","message":message};
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(RESULT));
    }
    

    
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
    let userToken = receivedPost.sourceUToken;
    let token = receivedPost.transaction_token;
    let accept = receivedPost.accept;
    let ammount = receivedPost.amount;
    let message;
    let balancePayer;
    let balance;
    let userId = await queryDatabase ("SELECT userId FROM users WHERE sessionToken='"+userToken+"';");
    if(userId.length!=0){
      userId=userId[0].userId;
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
          balance = balanceReceptor[0].userBalance + ammount;
          console.log("si");
        }else{
          queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'insufficient balance'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
          message = "Transacció rebutjada, el usuari que está pagant no té suficient sou";
        }
      }else{
        queryDatabase("UPDATE transactions SET userOrigin ="+ userId +", ammount ="+ ammount +", accepted = "+ "'rejectedByUser'"+ ", timeFinish = NOW() WHERE token ='"+ token+"';");
        message = "Transacció rebutjada per l'usuari";
      }
      await queryDatabase("COMMIT;");
      await queryDatabase("SET autocommit = 1;");
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({"status":"OK", "message":message, "balance":balance}));
    }else{
      message = "No s'ha trobat el usuari d'origen";
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({"status":"ERROR", "message":message}));
    }

}catch(e){
  console.log("ERROR: " + e.stack)
  await queryDatabase("SET autocommit = 1;");
}
}

function isValidNumber(number) {
  if(typeof number =="number"){
    return true;
  }else{
    return false
  }
}
function generateToken(){
  return new Promise(async (resolve, reject) => {
    let token = "ST-"+uuidv4();
    let checkToken = await queryDatabase ("SELECT userId FROM users WHERE sessionToken='"+token+"';");
    if(checkToken.length==0){
      resolve(token);
    }else{
      console.log("mismo");
      resolve(generateToken());
    }
  });
}
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

    connection.query(query, (error, results) => { 
      if (error) reject(error);
      resolve(results)
    });
     
    connection.end();
  })
}