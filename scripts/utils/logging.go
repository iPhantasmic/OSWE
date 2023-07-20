package utils

import (
	"log"
)

// Wrappers for printing and logging to console

func PrintInfo(message string) {
	log.Println("[=] " + message)
}

func PrintSuccess(message string) {
	log.Println("\033[32m[+] \033[0m" + message)
}

func PrintFailure(message string) {
	log.Println("\033[31m[-] \033[0m" + message)
}
