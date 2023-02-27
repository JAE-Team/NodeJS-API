/* Este script es solo para crear la BBDD inicial y tenerla con perfiles de prueba */

DROP TABLE IF EXISTS users_transactions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transactions;

CREATE TABLE users(
userId VARCHAR(255) PRIMARY KEY,
userPassword VARCHAR(255),
userName VARCHAR(255),
userSurname VARCHAR(255),
userEmail VARCHAR(255),
userBalance DOUBLE
);

/* Segun ha especificado Enric, en principio accepted era sobre si el usuario aceptaba o no
pero habria que ampliarlo a otros estados, para poder recoger varias posibilidades
de como puede terminar la transaccion */

CREATE TABLE transactions(
token VARCHAR(255) PRIMARY KEY,
userOrigin VARCHAR(255),
userDestiny VARCHAR(255),
ammount DOUBLE,
accepted ENUM('waitingAcceptance', 'acceptedByUser', 'rejectedByUser', 'insufficient balance', 'otherError'),
timeSetup TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
timeStart TIMESTAMP,
timeFinish TIMESTAMP
);

CREATE TABLE users_transactions (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  users_userId VARCHAR(225),
  transactions_token VARCHAR(255),
  roleUser ENUM('origin', 'destiny'),
  FOREIGN KEY (users_userId) REFERENCES users (userId),
  FOREIGN KEY (transactions_token) REFERENCES transactions (token)
);

INSERT INTO users (userId, userPassword, userName, userSurname, userEmail, userBalance)
VALUES ('+34600700800', 'contrasenya1', 'John', 'Doe', 'johndoe@example.com', 100.0);

INSERT INTO users (userId, userPassword, userName, userSurname, userEmail, userBalance)
VALUES ('+34600450500', '1q2w3e4r', 'Jack', 'Sparrow', 'jsparrow@pirate.com', 100.0);

INSERT INTO users (userId, userPassword, userName, userSurname, userEmail, userBalance)
VALUES ('+34200300', 'nopassword', 'Obi Wan', 'Kenobi', 'obiwKenobi@jedi.com', 100.0);

/* CREATE TABLE users(
id INTEGER PRIMARY KEY AUTO_INCREMENT,
userID VARCHAR(9)
); */

