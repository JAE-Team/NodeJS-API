DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transacctions;
DROP TABLE IF EXISTS users_transactions;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transacctions;
DROP TABLE IF EXISTS users_transactions;

CREATE TABLE users(
userId INTEGER PRIMARY KEY AUTO_INCREMENT,
userPassword VARCHAR(30),
userName VARCHAR(30),
userSurname VARCHAR(255),
userEmail VARCHAR(30),
userPhone int
);

CREATE TABLE transactions(
token VARCHAR(255) PRIMARY KEY AUTO_INCREMENT,
userOrigin INTEGER,
userDestiny INTEGER,
ammount DOUBLE,
accepted BOOLEAN,
timeSetup DATE,
timeAccept DATE
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