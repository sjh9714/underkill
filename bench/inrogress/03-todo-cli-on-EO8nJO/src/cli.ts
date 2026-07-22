import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TODOS_FILE = "todos.json";

function loadTodos(): string[] {
  if (!existsSync(TODOS_FILE)) return [];
  return JSON.parse(readFileSync(TODOS_FILE, "utf8"));
}

function saveTodos(todos: string[]): void {
  writeFileSync(TODOS_FILE, JSON.stringify(todos));
}

const [command, ...args] = process.argv.slice(2);

if (command === "add") {
  const text = args.join(" ");
  const todos = loadTodos();
  todos.push(text);
  saveTodos(todos);
} else if (command === "list") {
  const todos = loadTodos();
  for (const todo of todos) {
    console.log(todo);
  }
}
