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
const port = process.env.PORT || 3000

// Publish static files from 'public' folder
//app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, appListen)
function appListen () {
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
}
app.post('/checkServer',checkServer)
async function checkServer (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({"status":"OK"}));
}
app.post('/people',getPeople)
async function getPeople (req, res) {
  await wait(5000);
  var people = {};
  res.writeHead(200, { 'Content-Type': 'application/json' });
  console.log("si va");
  var result = await queryDatabase("SELECT * FROM people");
  console.log(result[0].name);
  for(var i in result){
    console.log(result[i].id);
  }
  res.end(JSON.stringify({"result":result}));
}
app.post('/updatePerson',updatePerson)
async function updatePerson (req, res) {
  let data = await post.getPostObject(req);
  let status = "KO";
  let userCheck = checkUser(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if(userCheck.status){
    var result = await queryDatabase("UPDATE people SET name='"+data.name+"', surname='"+data.surname+"', mail='"+data.mail+"', phone='"+data.phone+"', street='"+data.street+"', city='"+data.city+"' WHERE id="+data.id+";");
    status = "OK";
  }
  
  res.end(JSON.stringify({"status":status,"result": userCheck.result}));
}
app.post('/addPerson',addPerson)
async function addPerson (req, res) {
  let data = await post.getPostObject(req);
  let status = "KO";
  let userCheck = checkUser(data);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if(userCheck.status){
    var result = await queryDatabase("INSERT INTO people(name, surname, mail, phone, street, city) VALUES ('"+data.name+"', '"+data.surname+"', '"+data.mail+"', '"+data.phone+"', '"+data.street+"', '"+data.city+"');");
    status = "OK";
  }
  res.end(JSON.stringify({"status":status,"result": userCheck.result}));
}

function checkUser(json){
  if(containsNumber(json.name)| json.name==""){
    return {status:false,result:"Invalid name."};
  }
  if(containsNumber(json.surname)| json.name==""){
    return {status:false,result:"Invalid surname."};
  }
  if(!checkEmail(json.mail)| json.mail==""){
    return {status:false,result:"Invalid mail."};
  }
  if(!checkPhone(json.phone)| json.phone==""){
    return {status:false,result:"Invalid phone number."};
  }
  if(!checkStreet(json.street)| json.street==""){
    return {status:false,result:"Invalid street."};
  }
  if(!checkCity(json.city)| json.city==""){
    return {status:false,result:"Invalid city."};
  }

  return {status:true,result:""};
}
function checkPhone(str){
  var filter = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
  return filter.test(str)
}
function checkEmail(str){
  var filter = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return filter.test(str);
}
function checkStreet(str) {
  return /^[A-Za-z0-9 ]*$/.test(str);
}
function containsNumber(str) {
  return /\d/.test(str);
}
function checkCity(str) {
  return /^[A-Za-z]*$/.test(str);
}
// Perform a query to the database
function queryDatabase (query) {

  return new Promise((resolve, reject) => {
    var connection = mysql.createConnection({
      host: process.env.MYSQLHOST || "localhost",
      port: process.env.MYSQLPORT || 3306,
      user: process.env.MYSQLUSER || "root",
      password: process.env.MYSQLPASSWORD || "Persiana@1234",
      database: process.env.MYSQLDATABASE || "prova"
    });

    connection.query(query, (error, results) => { 
      if (error) reject(error);
      resolve(results)
    });
     
    connection.end();
  })
}