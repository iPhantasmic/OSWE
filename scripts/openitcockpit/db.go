package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"

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
		log.Fatalln("Failed to insert content: ", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		log.Fatalln("Failed to get last insert ID: ", err)
	}

	utils.PrintSuccess("Content inserted!")
	return id
}

func GetContent(location string) (content string) {
	row := utils.DB.QueryRow("SELECT content FROM content WHERE location = ?", location)

	err := row.Scan(&content)
	if err != nil {
		log.Fatalln("Failed to get content for "+location+": ", err)
	}

	return content
}

func GetLocations() []string {
	var locations []string

	rows, err := utils.DB.Query("SELECT DISTINCT location FROM content")
	if err != nil {
		log.Fatalln("Failed to get all locations: ", err)
	}

	for rows.Next() {
		var location string
		err = rows.Scan(&location)
		if err != nil {
			log.Println("Failed to scan: ", err)
		}
		locations = append(locations, location)
	}

	return locations
}

func main() {
	create := flag.Bool("create", false, "create database")
	insert := flag.Bool("insert", false, "insert content")
	get := flag.Bool("get", false, "get content")
	getAllLocations := flag.Bool("getLocations", false, "get all locations")

	location := flag.String("location", "", "location data")
	content := flag.String("content", "", "content")
	flag.Parse()
	// parse args
	args := os.Args[:]
	log.Println("Args: ", args)

	if len(args) < 2 || len(args) > 4 {
		utils.PrintFailure(fmt.Sprintf("usage: %s [-create/insert/get/getLocations] [-location] [-content]", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -create", os.Args[0]))
		utils.PrintFailure(fmt.Sprintf("eg: %s -insert -location=hello -content=world", os.Args[0]))
		os.Exit(1)
	}

	utils.ConnectDB("./sqlite.db")

	if *create {
		utils.PrintInfo("Creating table...")
		CreateTable()
	} else if *insert {
		if *location == "" || *content == "" {
			log.Fatalln("-insert requires -location, -content")
		}

		utils.PrintInfo("Inserting data...")
		result := InsertContent(*location, *content)
		utils.PrintSuccess(fmt.Sprintf("New row ID: %d", result))
	} else if *get {
		if *location == "" {
			log.Fatalln("-get requires -location")
		}

		utils.PrintInfo("Getting content...")
		result := GetContent(*location)
		utils.PrintSuccess("Content: " + result)
	} else if *getAllLocations {
		utils.PrintInfo("Getting all locations...")
		results := GetLocations()
		utils.PrintSuccess("Locations:")
		for _, result := range results {
			fmt.Println(result)
		}
	}
}
