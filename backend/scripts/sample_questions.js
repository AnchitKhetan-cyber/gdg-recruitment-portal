/**
 * Seed question bank for the GDG technical screening round.
 * `correctAnswers` is the index into `options` of the right choice.
 */
export const sampleQuestions = [
  {
    question: "What is the time complexity of binary search on a sorted array of n elements?",
    options: ["O(n)", "O(log n)", "O(n log n)", "O(n^2)"],
    correctAnswers: 1
  },
  {
    question: "Which data structure does a breadth-first search use to track the frontier?",
    options: ["Stack", "Queue", "Priority queue", "Linked list"],
    correctAnswers: 1
  },
  {
    question: "In React, what is the primary purpose of the useEffect hook?",
    options: [
      "To synchronise a component with an external system",
      "To create a component",
      "To style elements",
      "To replace props"
    ],
    correctAnswers: 0
  },
  {
    question: "What does REST stand for?",
    options: [
      "Representational State Transfer",
      "Remote Endpoint Secure Transfer",
      "React Express State Transfer",
      "Remote Execution State Timing"
    ],
    correctAnswers: 0
  },
  {
    question: "Which of these is NOT a standard HTTP method?",
    options: ["GET", "POST", "SEND", "PATCH"],
    correctAnswers: 2
  },
  {
    question: "What is a JSON Web Token primarily used for?",
    options: [
      "Encrypting a database at rest",
      "Carrying signed claims about an authenticated identity",
      "Compressing HTTP responses",
      "Load balancing between servers"
    ],
    correctAnswers: 1
  },
  {
    question: "In Git, what does `git rebase` do that `git merge` does not?",
    options: [
      "Rewrites commits onto a new base, producing a linear history",
      "Deletes the source branch",
      "Pushes to the remote automatically",
      "Creates a tag"
    ],
    correctAnswers: 0
  },
  {
    question: "Which HTTP status code indicates that the request was understood but is forbidden?",
    options: ["401", "403", "404", "500"],
    correctAnswers: 1
  },
  {
    question: "In MongoDB, what is an index primarily used for?",
    options: [
      "Enforcing a schema",
      "Speeding up queries at the cost of write throughput and storage",
      "Encrypting documents",
      "Replicating data across shards"
    ],
    correctAnswers: 1
  },
  {
    question: "What does the CSS `flex: 1` shorthand expand to?",
    options: [
      "flex-grow: 1; flex-shrink: 1; flex-basis: 0%",
      "flex-grow: 1; flex-shrink: 0; flex-basis: auto",
      "flex-grow: 0; flex-shrink: 1; flex-basis: 100%",
      "flex-direction: row"
    ],
    correctAnswers: 0
  },
  {
    question: "Which of these correctly describes a pure function?",
    options: [
      "It mutates its arguments",
      "It returns the same output for the same input and has no side effects",
      "It always returns a promise",
      "It can only take one argument"
    ],
    correctAnswers: 1
  },
  {
    question: "What problem does the CAP theorem describe?",
    options: [
      "The trade-off between consistency, availability and partition tolerance",
      "The cost of caching",
      "The limits of CPU parallelism",
      "The complexity of sorting"
    ],
    correctAnswers: 0
  },
  {
    question: "In JavaScript, what is the result of `typeof null`?",
    options: ["'null'", "'undefined'", "'object'", "'number'"],
    correctAnswers: 2
  },
  {
    question: "Which technique prevents SQL injection most reliably?",
    options: [
      "Escaping quotes manually",
      "Using parameterised queries / prepared statements",
      "Hiding the database port",
      "Minifying the backend code"
    ],
    correctAnswers: 1
  },
  {
    question: "What is the purpose of a Docker image layer cache?",
    options: [
      "To reduce rebuild time by reusing unchanged layers",
      "To encrypt the container filesystem",
      "To limit container memory",
      "To route container traffic"
    ],
    correctAnswers: 0
  },
  {
    question: "In Big-O terms, what is the average lookup cost of a well-sized hash table?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswers: 0
  },
  {
    question: "Which HTML attribute makes an image accessible to screen readers?",
    options: ["title", "alt", "aria-image", "longdesc"],
    correctAnswers: 1
  },
  {
    question: "What does `npm ci` do differently from `npm install`?",
    options: [
      "Installs exactly the lockfile tree, deleting node_modules first",
      "Installs only dev dependencies",
      "Runs continuous integration tests",
      "Updates the lockfile to the newest versions"
    ],
    correctAnswers: 0
  },
  {
    question: "In an Express app, what is middleware?",
    options: [
      "A function with access to the request, response and the next handler",
      "A database driver",
      "A templating engine",
      "A build tool"
    ],
    correctAnswers: 0
  },
  {
    question: "Which of these best describes idempotency in HTTP?",
    options: [
      "Repeating the same request has the same effect as making it once",
      "The request is always cached",
      "The request never fails",
      "The response body is always empty"
    ],
    correctAnswers: 0
  }
]
