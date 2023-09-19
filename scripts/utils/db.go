package utils

import (
	"database/sql"
	"errors"
	"io/fs"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

// Helper functions for starting up an SQLite DB

var DB *sql.DB

func ConnectDB(dbFilePath string) {
	if _, err := os.Open(dbFilePath); err != nil {
		// database file not created, create it
		if errors.Is(err, fs.ErrNotExist) {
			PrintInfo("DB file does not exist, creating now...")
			file, err := os.Create(dbFilePath)
			if err != nil {
				log.Fatalln("Error while creating SQLite DB: ", err)
			}
			file.Close()
		}
	}

	db, err := sql.Open("sqlite3", dbFilePath)
	if err != nil {
		log.Fatalln("Failed to connect to DB: ", err)
	}
	DB = db
	PrintSuccess("Connected to DB!")
}
