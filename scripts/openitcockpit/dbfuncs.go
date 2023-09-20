package main

import (
	"log"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 10.6.3.1 - Database

func CreateTable() {
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

	utils.PrintSuccess("Content inserted!")
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
