package utils

import (
	"fmt"
	"log"
	"os"
)

// Wrappers for creating files

func CreateZipFile(fileName string) *os.File {
	PrintInfo("Creating zip archive...")
	archive, err := os.Create(fileName)
	if err != nil {
		log.Println("Error while creating zip archive: ", err)
	}

	return archive
}

func CreateFile(fileName, contents string) {
	err := os.WriteFile(fileName, []byte(contents), 0644)
	if err != nil {
		log.Println(fmt.Sprintf("Error while creating %s: ", fileName), err)
	}
}

// file1, err := os.OpenFile("poc.txt", os.O_APPEND|os.O_CREATE|os.O_RDWR, 0644)
