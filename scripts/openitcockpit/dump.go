package main

import (
	"path"
	"strings"

	"github.com/iPhantasmic/OSWE/scripts/utils"
)

func saveToFile(url, content string) {
	_, fileName := path.Split(url)
	if !strings.HasPrefix(fileName, ".html") {
		fileName += ".html"
	}

	utils.CreateFile("./content/"+fileName, content)
}

func main() {
	utils.ConnectDB("./sqlite.db")

	locations := GetLocations()
	for _, location := range locations {
		content := GetContent(location)
		saveToFile(location, content)
	}

	utils.PrintSuccess("Done!")
}
