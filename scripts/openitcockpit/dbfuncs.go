package main

import (
	"log"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 10.6.3.1 - Database

func CreateContentTable() {
	stmt, err := utils.DB.Prepare("CREATE TABLE IF NOT EXISTS content(" +
		"id integer PRIMARY KEY AUTOINCREMENT, location text NOT NULL, content blob" +
		");")
	if err != nil {
		log.Fatalln("Failed to prepare statement: ", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec()
	if err != nil {
		log.Fatalln("Failed to create table: ", err)
	}

	utils.PrintSuccess("Table 'content' created!")
}

func InsertContent(location, content string) int64 {
	res, err := utils.DB.Exec("INSERT INTO content(location,content) VALUES(?,?)", location, content)
	if err != nil {
		utils.PrintFailure("Failed to insert content: " + err.Error())
	}

	id, err := res.LastInsertId()
	if err != nil {
		utils.PrintFailure("Failed to get last insert ID: " + err.Error())
	}

	return id
}

func GetContent(location string) (content string) {
	row := utils.DB.QueryRow("SELECT content FROM content WHERE location = ?", location)

	err := row.Scan(&content)
	if err != nil {
		utils.PrintFailure("Failed to get content for " + location + ": " + err.Error())
	}

	return content
}

func GetLocations() []string {
	var locations []string

	rows, err := utils.DB.Query("SELECT DISTINCT location FROM content")
	if err != nil {
		utils.PrintFailure("Failed to get all locations: " + err.Error())
	}

	for rows.Next() {
		var location string
		err = rows.Scan(&location)
		if err != nil {
			utils.PrintFailure("Failed to scan: " + err.Error())
		}
		locations = append(locations, location)
	}

	return locations
}

// Ex 10.6.4.2 - Extra Mile: Table to store Credentials and Cookies

func CreateCredentialTable() {
	stmt, err := utils.DB.Prepare("CREATE TABLE IF NOT EXISTS credential(" +
		"id integer PRIMARY KEY AUTOINCREMENT, username text NOT NULL, password text NOT NULL" +
		");")
	if err != nil {
		log.Fatalln("Failed to prepare statement: ", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec()
	if err != nil {
		log.Fatalln("Failed to create table: ", err)
	}

	utils.PrintSuccess("Table 'credential' created!")
}

func InsertCredential(user, pass string) int64 {
	res, err := utils.DB.Exec("INSERT INTO credential(username,password) VALUES(?,?)", user, pass)
	if err != nil {
		utils.PrintFailure("Failed to insert credential: " + err.Error())
	}

	id, err := res.LastInsertId()
	if err != nil {
		utils.PrintFailure("Failed to get last insert ID: " + err.Error())
	}

	return id
}

func CreateCookieTable() {
	stmt, err := utils.DB.Prepare("CREATE TABLE IF NOT EXISTS cookie(" +
		"id integer PRIMARY KEY AUTOINCREMENT, key text NOT NULL, value text NOT NULL" +
		");")
	if err != nil {
		log.Fatalln("Failed to prepare statement: ", err)
	}
	defer stmt.Close()

	_, err = stmt.Exec()
	if err != nil {
		log.Fatalln("Failed to create table: ", err)
	}

	utils.PrintSuccess("Table 'cookie' created!")
}

func InsertCookie(key, value string) int64 {
	res, err := utils.DB.Exec("INSERT INTO cookie(key,value) VALUES(?,?)", key, value)
	if err != nil {
		utils.PrintFailure("Failed to insert cookie: " + err.Error())
	}

	id, err := res.LastInsertId()
	if err != nil {
		utils.PrintFailure("Failed to get last insert ID: " + err.Error())
	}

	return id
}
