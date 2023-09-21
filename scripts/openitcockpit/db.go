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
		utils.PrintInfo("Creating tables...")
		CreateContentTable()
		CreateCredentialTable()
		CreateCookieTable()
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
