import { readFile, writeFile } from "fs/promises";

import path from "path";

const dbFPath = path.resolve("db.txt");
var dbRef = null;

function text2arr(txt) {
	return txt.split("\n").map((record) => {
		const values = record.split("\t");
		return { name: values[0], lastSeen: values[1] };
	});
}

function arr2text(arr) {
	return arr.map((obj) => `${obj.name}\t${obj.lastSeen}`).join("\n");
}

function isValidUserName(userName){
	return userName && userName.length < 65;
}

async function findUser(userName) {
	if(!isValidUserName(userName)){
		throw new Error("Bad user name");
	}
	if (!dbRef) {
		const dbAsTxt = await readFile(dbFPath, "utf8");
		dbRef = text2arr(dbAsTxt);
	}
	return dbRef.find((x) => x.name === userName);
}

async function createUser(userName) {
	if(!isValidUserName(userName)){
		throw new Error("Bad user name");
	}
	dbRef.push({ name: userName, lastSeen: Date.now() });
	await writeFile(dbFPath, arr2text(dbRef), {encoding: "utf8"});
}

async function updateUser(newUserObj) {
	if(!isValidUserName(newUserObj.name)){
		throw new Error("Bad user name");
	}
	const oldUserObj = await findUser(newUserObj.name);
	oldUserObj.name = newUserObj.name;
	oldUserObj.lastSeen = newUserObj.lastSeen;
	await writeFile(dbFPath, arr2text(dbRef), {encoding: "utf8"});
}

export default {findUser, createUser, updateUser, isValidUserName};