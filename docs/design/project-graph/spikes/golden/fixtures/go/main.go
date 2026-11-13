package main

import (
    "fmt"
    "example.com/golden/greet"
    "example.com/missing/pkg"
)

func main() { fmt.Println(greet.Name("Ada")); _ = pkg.Value }
