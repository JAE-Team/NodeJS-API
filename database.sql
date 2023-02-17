/* Este script es solo para crear la BBDD inicial y tenerla con perfiles de prueba */

DROP TABLE IF EXISTS users_transactions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transacctions;

CREATE TABLE users(
userId INTEGER PRIMARY KEY,
userPassword VARCHAR(30),
userName VARCHAR(30),
userSurname VARCHAR(255),
userEmail VARCHAR(30)
);

/* Segun ha especificado Enric, en principio accepted era sobre si el usuario aceptaba o no
pero habria que ampliarlo a otros estados, para poder recoger varias posibilidades
de como puede terminar la transaccion */

CREATE TABLE transactions(
token VARCHAR(255) PRIMARY KEY,
userOrigin INTEGER,
userDestiny INTEGER,
ammount DOUBLE,
accepted ENUM('waitingAcceptance', 'acceptedByUser', 'rejectedByUser', 'Insufficient balance', 'otherError'),
timeSetup DATE,
timeStart DATE,
timeFinish DATE
);

CREATE TABLE users_transactions (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  users_userId INTEGER,
  transactions_token INTEGER,
  roleUser ENUM('origin', 'destiny'),
  FOREIGN KEY (users_userId) REFERENCES users (userId),
  FOREIGN KEY (transactions_token) REFERENCES transactions (token)
);

/* CREATE TABLE users(
id INTEGER PRIMARY KEY AUTO_INCREMENT,
userID VARCHAR(9)
); */

INSERT INTO users(userID) VALUES("655784396")

