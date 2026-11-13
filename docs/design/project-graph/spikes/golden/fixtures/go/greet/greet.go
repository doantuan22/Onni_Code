package greet

import "example.com/golden/model"

func Name(s string) string { return model.Format(s) }
