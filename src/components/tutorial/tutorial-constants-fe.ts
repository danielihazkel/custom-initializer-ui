import { Module } from './tutorial-types';

export const CURRICULUM_FE: Module[] = [
  {
    id: 'react-fundamentals',
    title: 'React Fundamentals',
    icon: 'Component',
    lessons: [
      {
        id: 'components-props',
        title: 'Components & Props',
        description: 'The unit of UI in React. How props flow down, why composition beats inheritance, and the rule that makes refactors safe.',
        content: `### 1. A component is just a function
A React component is a function that returns JSX. Given the same inputs (**props**), it returns the same UI. That's it. No classes required, no lifecycle methods to memorize — modern React is functional.

### 2. Props flow one way: down
Props are read-only inputs. A parent passes data to a child; the child cannot mutate what it received. This one-way flow is what makes React apps debuggable — when something looks wrong, you trace **upward** to find the source of truth.

- A child that needs to "change" its prop is asking the wrong question. The state lives somewhere up the tree, and the child should call a callback (also passed as a prop) to ask the owner to update it.
- Never write \`props.user.name = "..."\`. It will sometimes appear to work and silently break later.

### 3. Composition over inheritance
React has no \`extends MyComponent\` story. Instead, components compose by **rendering each other** and by accepting \`children\` (or render-prop / slot props). A \`<Card>\` doesn't subclass anything — it wraps whatever you put inside it.

### 4. Naming and granularity
- PascalCase component names. Lowercase names are treated as HTML tags by JSX.
- Split a component when a piece of it has its own state, gets reused, or is large enough that a name would help the next reader.
- Don't split prematurely. Three sections of JSX in one file is fine. A \`<TitleText>\` wrapper around \`<h1>\` is noise.`,
        codeSnippet: `// A component is a function. Props are its arguments.
type GreetingProps = {
  name: string;
  excited?: boolean;
};

function Greeting({ name, excited = false }: GreetingProps) {
  return <h1>Hello, {name}{excited ? '!' : '.'}</h1>;
}

// Composition: a wrapper that doesn't care what it wraps.
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>;
}

// Parent owns state, passes data DOWN, passes a callback DOWN.
function App() {
  const [name, setName] = useState('Ada');
  return (
    <Card>
      <Greeting name={name} excited />
      <input value={name} onChange={(e) => setName(e.target.value)} />
    </Card>
  );
}

// ❌ Don't mutate props
function BadGreeting({ user }: { user: { name: string } }) {
  user.name = user.name.toUpperCase(); // Will bite you later
  return <h1>{user.name}</h1>;
}`,
        language: 'tsx',
      },
      {
        id: 'state-usestate',
        title: 'State & useState',
        description: 'Local state with the useState hook. Immutability, functional updaters, and why setState is async.',
        content: `### 1. State is what makes a component dynamic
Props are inputs from outside. **State** is data the component owns. \`useState\` returns a pair: the current value, and a setter to schedule an update.

### 2. State updates are immutable
You don't mutate the existing state object — you give React a **new** object. React compares references (\`Object.is\`) to decide whether to re-render. Mutating in place skips the re-render.

- Arrays: use \`[...arr, item]\`, \`arr.filter(...)\`, \`arr.map(...)\`. Never \`arr.push(item)\` followed by \`setArr(arr)\`.
- Objects: use \`{ ...obj, key: value }\`. Never \`obj.key = value\`.

### 3. Setters are asynchronous
Calling \`setCount(count + 1)\` does not change \`count\` immediately. React batches updates and re-renders later. If you read \`count\` right after, you'll see the **old** value. This is a feature, not a bug — it lets React batch many setters into one render.

### 4. Functional updaters
When the new state depends on the previous state, use the function form: \`setCount(prev => prev + 1)\`. This guarantees you operate on the latest value, even if React batches multiple updates.

### 5. One state per concept
Don't cram unrelated state into one object. \`useState\` per concept reads better and avoids accidental "merge everything" patterns from class components.`,
        codeSnippet: `import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  // ❌ Reads stale value when called twice in a row
  const incrementTwiceBuggy = () => {
    setCount(count + 1);
    setCount(count + 1); // count is still the OLD value here
  };

  // ✅ Functional updater — always operates on the latest
  const incrementTwice = () => {
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
  };

  return <button onClick={incrementTwice}>{count}</button>;
}

function TodoList() {
  const [todos, setTodos] = useState<string[]>([]);

  // ❌ Mutates the array, React won't re-render
  const addBuggy = (text: string) => {
    todos.push(text);
    setTodos(todos);
  };

  // ✅ New array, new reference
  const add = (text: string) => {
    setTodos(prev => [...prev, text]);
  };

  return <ul>{todos.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}`,
        language: 'tsx',
      },
      {
        id: 'effects-useeffect',
        title: 'Effects & useEffect',
        description: 'Synchronizing with the outside world. Effect timing, the dependency array, cleanup, and when not to reach for an effect.',
        content: `### 1. What an effect is for
\`useEffect\` is for **synchronizing your component with something outside React** — a subscription, a timer, the document title, an analytics call. If your work is purely "compute UI from props/state," you don't need an effect.

### 2. The dependency array
The second argument controls when the effect re-runs.
- \`[]\` — runs once after mount, cleanup runs at unmount.
- \`[dep1, dep2]\` — runs after every render where any dep changed.
- omitted — runs after every render. Almost always wrong.

The dependency array is **not optional advice**. If your effect uses a value from props/state and you don't list it, you'll read stale values forever.

### 3. Cleanup
Return a function from your effect to undo whatever you set up — unsubscribe, clear the timer, abort the fetch. React calls cleanup before re-running the effect and at unmount. Skip cleanup and you'll leak listeners.

### 4. When NOT to use an effect
- **Deriving state from props** — just compute it during render. \`const fullName = first + ' ' + last\` is not an effect.
- **Responding to a user event** — put the logic in the event handler. An effect that watches a state set by an onClick is one indirection too many.
- **Resetting state when a prop changes** — prefer a \`key\` prop that remounts the component.

The mental model: effects are an **escape hatch** for the parts of your app that aren't React. Use them sparingly.`,
        codeSnippet: `import { useState, useEffect } from 'react';

// ✅ Synchronizing with a non-React thing (the document title)
function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

// ✅ Subscription with cleanup
function WindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <span>{width}px</span>;
}

// ❌ DON'T use an effect to derive state from props
function BadFullName({ first, last }: { first: string; last: string }) {
  const [full, setFull] = useState('');
  useEffect(() => {
    setFull(first + ' ' + last); // Extra render for nothing
  }, [first, last]);
  return <h1>{full}</h1>;
}

// ✅ Just compute it
function FullName({ first, last }: { first: string; last: string }) {
  const full = first + ' ' + last;
  return <h1>{full}</h1>;
}`,
        language: 'tsx',
        showHooksLifecycleVisualizer: true,
      },
      {
        id: 'lists-keys',
        title: 'Lists & Keys',
        description: 'Why React needs keys, the index-as-key trap, and how stable identity prevents subtle UI bugs.',
        content: `### 1. Why keys exist
When you render a list, React needs to match each rendered element to its previous-render counterpart so it knows what to add, move, or remove. **Keys are the identity** React uses to do that matching.

### 2. The index-as-key trap
Using the array index as the key works only if the list is **append-only and never reordered**. The moment you insert at the front, sort, or filter, the indices shift — and React thinks every item changed. You'll see:
- Form inputs that keep the wrong value after a delete
- Animations that play on every item instead of the new one
- Selection state attached to the wrong row

### 3. Stable, unique IDs
The right key is a **stable identifier from the data** — a database id, a UUID generated when the item was created, or a content hash if the data is truly immutable. Generate the id when you create the item, not when you render it (\`Math.random()\` inside render gives you a new key every time → React thinks every item is new every render).

### 4. Keys are scoped to siblings
Keys only need to be unique among siblings of the same list. Nesting lists is fine; you don't need globally unique keys.

### 5. Keys aren't passed to your component
A common surprise: \`key\` is consumed by React. Your component doesn't receive it as a prop. If you also need the id inside the component, pass it as a separate prop.`,
        codeSnippet: `type Todo = { id: string; text: string; done: boolean };

// ❌ Index as key — breaks on insert/sort/filter
function TodoListBad({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo, i) => (
        <li key={i}>
          <input defaultValue={todo.text} />
        </li>
      ))}
    </ul>
  );
}

// ✅ Stable id from the data
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input defaultValue={todo.text} />
        </li>
      ))}
    </ul>
  );
}

// ❌ Random key on every render — every item looks new every time
function TodoListChaos({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={Math.random()}>{todo.text}</li>
      ))}
    </ul>
  );
}`,
        language: 'tsx',
      },
    ],
  },
  {
    id: 'typescript-react',
    title: 'TypeScript Essentials',
    icon: 'FileType2',
    lessons: [
      {
        id: 'typing-props',
        title: 'Typing Components & Props',
        description: 'Props interfaces, children, the React.FC debate, and the patterns that make refactors painless.',
        content: `### 1. Type your props explicitly
Define a \`type\` or \`interface\` for every component's props. Inline object types work for one-off small components, but a named type pays for itself the moment the component is reused or the props grow.

### 2. \`type\` vs \`interface\`
For component props, \`type\` is the modern default — it supports unions, intersections, and mapped types uniformly. \`interface\` is fine too; pick one and be consistent. Don't mix them in the same file just for variety.

### 3. \`React.FC\` is no longer needed
Older codebases use \`const Foo: React.FC<Props> = (props) => ...\`. The community has moved away from this:
- It implicitly adds \`children\` even when your component doesn't accept any
- It blocks generic components
- You don't need it for inferring the return type — TypeScript figures out \`JSX.Element\` on its own

Just write \`function Foo(props: FooProps) { ... }\` or \`const Foo = (props: FooProps) => ...\`.

### 4. Typing children
- Generic node (string, number, JSX, array, null): \`React.ReactNode\`
- A single element specifically: \`React.ReactElement\`
- A function child (render-prop pattern): the function signature itself

If your component must take children, list it explicitly in the props type. Don't rely on a wrapper to add it for you.

### 5. Extending HTML attributes
A button that "is a \`<button>\` plus extras" should accept all native button props so callers can pass \`onClick\`, \`disabled\`, \`aria-*\`, etc. without you re-declaring each one.`,
        codeSnippet: `import { ReactNode, ButtonHTMLAttributes } from 'react';

// ✅ Named props type, explicit children
type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

function Card({ title, footer, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div>{children}</div>
      {footer && <div className="footer">{footer}</div>}
    </div>
  );
}

// ✅ Extend native HTML props — callers get onClick, disabled, aria-*, etc. for free
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  return (
    <button className={\`btn btn-\${variant} \${className ?? ''}\`} {...rest} />
  );
}

// Usage — all native button props just work
<Button variant="secondary" onClick={...} disabled aria-label="Save" />`,
        language: 'tsx',
      },
      {
        id: 'hooks-generics',
        title: 'Hooks with Generics',
        description: 'Typing useState, useRef, and useReducer. When inference is enough and when you must annotate.',
        content: `### 1. \`useState\` — let inference do the work
\`useState(0)\` infers \`number\`. \`useState('')\` infers \`string\`. You only need to annotate when:
- The initial value is \`null\` or \`undefined\` but the eventual value is something else: \`useState<User | null>(null)\`
- The initial is \`[]\` but you want a typed array: \`useState<Todo[]>([])\`
- A union of multiple types: \`useState<'idle' | 'loading' | 'error'>('idle')\`

### 2. \`useRef\` — two distinct uses, two type patterns
- **Ref for a DOM element**: \`useRef<HTMLInputElement>(null)\`. The \`.current\` is read-only-ish (managed by React) and starts as \`null\` until React attaches the node.
- **Ref as a mutable value box** (no DOM): \`useRef<number>(0)\`. You can freely write to \`.current\` — it survives re-renders without triggering one.

### 3. \`useReducer\` — type the state and the action union
The classic place generics shine. Define a \`State\` type and an \`Action\` union, then \`useReducer<Reducer<State, Action>>\`. The reducer body becomes exhaustive: TypeScript narrows the action type inside each case.

### 4. Custom hooks
A custom hook is a function whose name starts with \`use\`. Type its return value as a \`const\` tuple (\`[value, setValue] as const\`) so consumers get \`[T, (v: T) => void]\` instead of \`(T | ((v: T) => void))[]\`.

### 5. Don't over-annotate
TypeScript inference in React is good. Adding a type annotation that just restates what TS already inferred is noise — and it goes stale when the implementation changes.`,
        codeSnippet: `import { useState, useRef, useReducer, Reducer } from 'react';

// ✅ Inference is enough
const [count, setCount] = useState(0); // number

// ✅ Annotate when initial is null
const [user, setUser] = useState<User | null>(null);

// ✅ Annotate empty arrays
const [todos, setTodos] = useState<Todo[]>([]);

// ✅ DOM ref
function FocusOnMount() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return <input ref={inputRef} />;
}

// ✅ Mutable value box
function RenderCount() {
  const renders = useRef(0);
  renders.current += 1;
  return <span>Rendered {renders.current} times</span>;
}

// ✅ Reducer with discriminated action union
type State = { count: number };
type Action = { type: 'inc' } | { type: 'dec' } | { type: 'set'; value: number };

const reducer: Reducer<State, Action> = (state, action) => {
  switch (action.type) {
    case 'inc': return { count: state.count + 1 };
    case 'dec': return { count: state.count - 1 };
    case 'set': return { count: action.value }; // 'value' is narrowed to number
  }
};

const [state, dispatch] = useReducer(reducer, { count: 0 });`,
        language: 'tsx',
      },
      {
        id: 'discriminated-unions',
        title: 'Discriminated Unions for Variants',
        description: 'How to model props that differ based on a variant. The pattern that turns runtime bugs into compile errors.',
        content: `### 1. The problem
A component has variants. A \`<Button>\` is sometimes \`primary\`, sometimes an \`icon\` button. The icon variant requires an \`icon\` prop; the primary variant doesn't take one. With a single flat props type, you either:
- Mark \`icon\` as optional and accept that consumers can pass it incorrectly (\`<Button variant="primary" icon={...} />\` compiles but is meaningless), or
- Add runtime checks the type system can't help you with.

### 2. The fix: a discriminated union
Make each variant its own type with a **literal discriminator**, then union them:

\`\`\`ts
type ButtonProps =
  | { variant: 'primary'; label: string }
  | { variant: 'icon'; icon: ReactNode; label: string };
\`\`\`

Now \`<Button variant="icon" />\` is a compile error — the \`icon\` prop is required when the variant is \`'icon'\`. And inside the component, narrowing by \`props.variant\` gives you full type safety on the variant-specific fields.

### 3. Narrowing in the implementation
TypeScript narrows on the discriminator inside an \`if\` or \`switch\`:

\`\`\`tsx
if (props.variant === 'icon') {
  return <button>{props.icon}{props.label}</button>; // 'icon' is in scope
}
return <button>{props.label}</button>;
\`\`\`

### 4. When to reach for it
- Components with mutually-exclusive prop sets (controlled vs uncontrolled inputs, link vs button, modal sizes with different content shapes)
- API response shapes (\`{ status: 'ok'; data: T } | { status: 'error'; message: string }\`)
- Reducer actions (we saw this in the previous lesson)

### 5. The trade-off
Each new variant means a new branch in the union and a new code path. If your variants share 95% of their props and differ in one boolean, a single type with an optional flag is fine — don't over-engineer.`,
        codeSnippet: `import { ReactNode } from 'react';

// ✅ Discriminated union — compile-time guarantee that 'icon' is present iff variant is 'icon'
type ButtonProps =
  | { variant: 'primary'; label: string; onClick: () => void }
  | { variant: 'secondary'; label: string; onClick: () => void }
  | { variant: 'icon'; icon: ReactNode; ariaLabel: string; onClick: () => void };

function Button(props: ButtonProps) {
  if (props.variant === 'icon') {
    return (
      <button aria-label={props.ariaLabel} onClick={props.onClick}>
        {props.icon}
      </button>
    );
  }
  return (
    <button className={\`btn-\${props.variant}\`} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

// ✅ Compiles — icon variant requires icon + ariaLabel
<Button variant="icon" icon={<SaveIcon />} ariaLabel="Save" onClick={...} />

// ❌ Compile error — icon variant requires icon prop
<Button variant="icon" label="Save" onClick={...} />

// ❌ Compile error — primary variant doesn't accept icon
<Button variant="primary" label="Save" icon={<SaveIcon />} onClick={...} />

// API response shapes — same pattern
type Result<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string };

function handle(result: Result<User>) {
  if (result.status === 'ok') {
    console.log(result.data.name); // 'data' is User here
  } else {
    console.error(result.message); // 'message' is string here
  }
}`,
        language: 'tsx',
      },
    ],
  },
  {
    id: 'state-management',
    title: 'State Management',
    icon: 'Database',
    lessons: [
      {
        id: 'local-lifted-context',
        title: 'Local, Lifted, Context',
        description: 'The three tiers of React state and how to choose between them. Most apps need very little outside this list.',
        content: `### 1. Start local
Default every piece of state to the smallest component that needs it. \`useState\` inside a leaf component is the cheapest, fastest, and least coupled option. Most state in a typical app belongs here.

### 2. Lift when siblings need to share
When two sibling components need the same value (or one needs to react to the other), move the state to their nearest common ancestor and pass it down as props plus a setter callback. This is the classic React pattern and it's enough for the vast majority of cases.

The signal that you need to lift: you find yourself trying to read state from a sibling. You can't — props flow down. Move the state up.

### 3. Reach for Context when prop drilling becomes painful
Context isn't a state-management library — it's a way to skip prop-passing through layers that don't care. Use it for:
- **Theme / locale / current user** — values that many components read and few components change
- **A piece of state shared by a deep subtree** — a form's state used by 8 nested fields, an editor's selection used throughout a toolbar

### 4. Context's two costs
- **Re-render scope**: every consumer of a context re-renders when the context value changes. Splitting one big context into several smaller ones (or using a selector library) limits that blast radius.
- **Indirection**: a component that reads from context is harder to reuse and harder to test in isolation. Pay this cost only when prop drilling is genuinely painful, not for every shared value.

### 5. Don't put server data in component state
Data fetched from your API isn't really "your" state — it's a cached copy of the server's state. Tools designed for that (React Query, SWR, RTK Query) handle staleness, refetching, deduplication, and loading states for free. Hand-rolling this with \`useState + useEffect\` always ends in a tangle.`,
        codeSnippet: `// ✅ Start local — state lives where it's used
function SearchBox() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

// ✅ Lift when siblings share — state moves to common parent
function FilterableList() {
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchBox value={query} onChange={setQuery} />
      <Results query={query} />
    </>
  );
}

// ✅ Context for cross-cutting values (theme, user, locale)
type Theme = 'light' | 'dark';
const ThemeContext = createContext<Theme>('light');

function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  return (
    <ThemeContext.Provider value={theme}>
      <Page />
    </ThemeContext.Provider>
  );
}

function DeepInsidePage() {
  const theme = useContext(ThemeContext);
  return <div className={theme}>...</div>;
}

// ❌ Don't hand-roll server state caching
function BadUserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  // ...you've reinvented half of React Query, badly
}`,
        language: 'tsx',
      },
      {
        id: 'external-stores',
        title: 'External Stores: Zustand & Redux',
        description: 'When useState and Context aren\'t enough. What an external store buys you and what it costs.',
        content: `### 1. The trigger
You reach for an external store when:
- The same state is read and written from many places far apart in the tree
- You need state to survive component unmounts (a wizard's progress, a draft form)
- Context re-renders are causing real performance issues
- You want time-travel debugging or middleware (logging, persistence)

If none of those apply, \`useState\` + lifting + a small Context is enough. Most apps never need a store.

### 2. Zustand — minimal, hooks-first
A few dozen lines of API. You define a store as a hook, components subscribe to slices. No provider needed, no actions/reducers boilerplate. The trade-off: less structure, easier to make a mess in a large codebase if conventions aren't enforced.

### 3. Redux Toolkit — structured, opinionated
The modern Redux. Slices encapsulate a piece of state with its reducers. RTK Query layers server-state caching on top. The trade-off: more files, more concepts, more "Redux thinking" — worth it on large teams where the structure pays for itself.

### 4. Selectors and equality
Both libraries let you subscribe to a **slice** of the store rather than the whole thing. A selector that returns a new object every render (e.g. \`s => ({ a: s.a, b: s.b })\`) defeats the optimization — the component re-renders on every store change. Use shallow equality, or split into multiple selectors.

### 5. The boring conclusion
Pick one and be consistent. The library matters less than the discipline of:
- Putting only **shared, persistent** state in the store
- Keeping local UI state local
- Never duplicating server state into the store — let your data-fetching layer cache it`,
        codeSnippet: `// === Zustand ===
import { create } from 'zustand';

type CartStore = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const useCart = create<CartStore>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
  clear: () => set({ items: [] }),
}));

// In a component — subscribe to a slice
function CartBadge() {
  const count = useCart((s) => s.items.length); // re-renders only when count changes
  return <span>{count}</span>;
}

// === Redux Toolkit ===
import { createSlice, configureStore } from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as CartItem[] },
  reducers: {
    add: (state, action: PayloadAction<CartItem>) => {
      state.items.push(action.payload); // RTK uses Immer — mutation is safe
    },
    remove: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
  },
});

const store = configureStore({ reducer: { cart: cartSlice.reducer } });

function CartBadgeRTK() {
  const count = useSelector((s: RootState) => s.cart.items.length);
  return <span>{count}</span>;
}`,
        language: 'tsx',
      },
      {
        id: 'derived-state',
        title: 'Derived State',
        description: 'Don\'t store what you can compute. Duplicated state is the source of half the bugs in a typical React codebase.',
        content: `### 1. The principle
If a value can be **computed from other state or props**, don't store it. Compute it during render. Stored derived state inevitably falls out of sync with its source — the bug class where the displayed total doesn't match the items in the cart.

### 2. Examples of derived state to delete
- \`fullName\` stored separately from \`firstName\` and \`lastName\` → \`const fullName = first + ' ' + last\` during render
- \`itemCount\` stored alongside \`items\` → \`items.length\`
- \`isValid\` boolean stored alongside form fields → compute from the fields each render
- A \`filteredItems\` array stored separately from \`items\` and \`filter\` → \`const filtered = items.filter(...)\` during render

### 3. "But isn't that wasteful?"
React is fast. Re-computing \`items.length\` or filtering a 100-item array on every render is **invisible**. Optimize when you measure a problem, not before. And if the computation is genuinely expensive, \`useMemo\` lets you cache without storing — see the next module.

### 4. Single source of truth
Every piece of state should live in **exactly one place**. If you find yourself writing "when X changes, also update Y," Y is probably derived state in disguise. Delete Y.

### 5. The exception: caching across renders
\`useMemo\` is for **expensive** computations or for keeping referential equality stable for downstream memoized components. It is not a place to put state. The result of \`useMemo\` is recomputed when its deps change — it's still derived, just cached.`,
        codeSnippet: `// ❌ Derived state stored separately — will go out of sync
function BadCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);

  const addItem = (item: CartItem) => {
    setItems(prev => [...prev, item]);
    setTotal(prev => prev + item.price); // forget this once → bug
    setCount(prev => prev + 1);          // forget this once → bug
  };

  return <div>{count} items, $\{total}</div>;
}

// ✅ One source of truth, derive the rest
function Cart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const count = items.length;

  const addItem = (item: CartItem) => {
    setItems(prev => [...prev, item]);
  };

  return <div>{count} items, $\{total}</div>;
}

// ✅ When the computation is genuinely expensive, useMemo caches it
function ExpensiveList({ items, query }: { items: Item[]; query: string }) {
  const filtered = useMemo(
    () => items.filter(i => fuzzyMatch(i.name, query)), // pretend this is slow
    [items, query]
  );
  return <List items={filtered} />;
}`,
        language: 'tsx',
      },
    ],
  },
  {
    id: 'performance-rendering',
    title: 'Performance & Rendering',
    icon: 'Zap',
    lessons: [
      {
        id: 're-render-model',
        title: 'How React Re-Renders',
        description: 'The mental model: what triggers a re-render, how it propagates, and why "it\'s slow" is almost always a measuring problem.',
        content: `### 1. What triggers a re-render
A component re-renders when one of three things happens:
- Its **state** changes (a setter is called with a new value)
- Its **parent re-renders** (and didn't pass through a memo)
- A **context** it consumes changes value

Props changing is **not** a separate trigger — props change because the parent re-rendered and passed new ones. Following the chain up, every re-render starts at a state change or a context update somewhere.

### 2. Re-render propagation
By default, when a component re-renders, **all of its children re-render too** — even children whose props didn't change. This sounds expensive but usually isn't. React's reconciliation is very fast, and the actual DOM updates only happen for things that actually changed.

### 3. "Re-render" doesn't mean "DOM update"
This is the most common confusion. React re-renders the component (calls the function, builds a new virtual tree), then **diffs** against the previous tree. Only the differences hit the DOM. A re-render that produces identical output costs almost nothing.

### 4. When to actually worry
Profile first. Open the React DevTools Profiler, record an interaction, and find the components that take real time. Almost always:
- A handful of components dominate the cost
- The fix is a smaller change than you expected (a missing key, a too-large context, an expensive computation that should be memoized)

### 5. The two real performance traps
- **Big context re-renders**: a context with many consumers, where a small change re-renders the world. Split the context.
- **Expensive computations on every render**: filtering a 50,000-item list, parsing a giant blob. \`useMemo\` (next lesson) handles these.

Premature memoization adds complexity for no gain. Measure, then optimize.`,
        codeSnippet: `// State change → this component re-renders → children re-render
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      {/* All three children re-render every click — usually fine */}
      <Display value={count} />
      <UnrelatedHeader />
      <UnrelatedFooter />
    </div>
  );
}

// React.memo skips re-rendering when props are referentially equal
const UnrelatedHeader = React.memo(function UnrelatedHeader() {
  console.log('header rendered'); // logs only once with memo
  return <h1>App</h1>;
});

// ❌ Inline object/function defeats memo — new reference every render
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <Child
      config={{ size: 'lg' }}        // new object every render
      onClick={() => doThing(count)} // new function every render
    />
  );
  // Even if Child is wrapped in React.memo, it re-renders every time
}

// ✅ Stable references — memo can do its job
function ParentFixed() {
  const [count, setCount] = useState(0);
  const config = useMemo(() => ({ size: 'lg' }), []);
  const onClick = useCallback(() => doThing(count), [count]);
  return <Child config={config} onClick={onClick} />;
}`,
        language: 'tsx',
        showRenderTreeVisualizer: true,
      },
      {
        id: 'memo-usememo-usecallback',
        title: 'memo, useMemo, useCallback',
        description: 'What each does, the referential-equality trap, and how to recognize when memoization makes things worse.',
        content: `### 1. The three tools
- **\`React.memo(Component)\`** — wraps a component so it skips re-rendering when its props are referentially equal to the previous render
- **\`useMemo(fn, deps)\`** — caches the **result** of \`fn()\` and returns the same reference until \`deps\` change
- **\`useCallback(fn, deps)\`** — caches the **function itself** and returns the same reference until \`deps\` change. (It's literally \`useMemo(() => fn, deps)\`.)

All three are about preserving **referential equality** so memoized children can skip work.

### 2. Why memoization often fails
\`React.memo\` compares props with \`Object.is\`. The moment a parent passes a freshly-created object, array, or function as a prop, the comparison fails and \`memo\` re-renders anyway:

\`\`\`tsx
<Child config={{ size: 'lg' }} />        // new object every render
<Child onClick={() => doThing()} />      // new function every render
<Child items={data.map(...)} />          // new array every render
\`\`\`

To make \`memo\` actually skip, you need \`useMemo\` for those object/array props and \`useCallback\` for those function props on the parent side.

### 3. When memoization is a net loss
Memoization itself has a cost: storing the previous deps, comparing them, and the mental load of reading the code. For a cheap component receiving cheap props, \`React.memo\` costs more than it saves.

Apply memoization to:
- Components that render large subtrees
- Components in long lists
- Computations that take measurable time (parse, sort, filter on big inputs)

Skip memoization for:
- Leaf components that render a few elements
- Anything you haven't profiled

### 4. The rule
Don't memoize defensively. Memoize **after** the profiler tells you to. The React team has said this for years; the codebases that ignore it end up with \`useCallback\` and \`useMemo\` on every function and value, and no measurable improvement.

### 5. The React Compiler is changing this
The upcoming React Compiler memoizes automatically. Codebases targeting the compiler can stop reaching for these manually. Until you're on it, the rules above hold.`,
        codeSnippet: `// ✅ memo + stable refs — Child skips re-renders when count changes
const Child = React.memo(function Child({
  items,
  onSelect,
}: {
  items: Item[];
  onSelect: (id: string) => void;
}) {
  console.log('Child rendered');
  return (
    <ul>
      {items.map(i => (
        <li key={i.id} onClick={() => onSelect(i.id)}>{i.name}</li>
      ))}
    </ul>
  );
});

function Parent({ data }: { data: Item[] }) {
  const [count, setCount] = useState(0);

  // Stable across renders unless 'data' changes
  const items = useMemo(() => data.filter(i => i.active), [data]);

  // Stable across renders unless deps change
  const onSelect = useCallback((id: string) => {
    console.log('selected', id);
  }, []);

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <Child items={items} onSelect={onSelect} />
    </>
  );
}

// ❌ Don't do this on every leaf component "just in case"
const Label = React.memo(function Label({ text }: { text: string }) {
  return <span>{text}</span>; // memoization costs more than it saves
});`,
        language: 'tsx',
        showRenderTreeVisualizer: true,
      },
      {
        id: 'lists-virtualization',
        title: 'Long Lists & Virtualization',
        description: 'When a list gets long enough that rendering it all is the bottleneck. The fix and how to know you need it.',
        content: `### 1. The threshold
Rendering a list of 100 items: fast. 1,000 items with simple rows: usually still fine. 10,000 items with rich content: visibly slow. The exact number depends on row complexity — a list of plain strings tolerates more items than a list of cards with images and buttons.

If your list **lags on scroll**, **stutters when items are added**, or **takes a noticeable beat to mount**, you've crossed the threshold.

### 2. The fix: virtualization
Virtualization renders only the rows currently visible in the viewport (plus a small overscan above and below). As the user scrolls, rows enter and leave the DOM. The list **looks** like all 10,000 items are there, but the DOM holds maybe 30.

The trade-off: rows have to be a known or measurable height, and some patterns (browser \`Cmd-F\`, screen readers traversing the list, native scroll-to-element) need extra care.

### 3. The libraries
- **\`react-window\`** — small, focused, the original. Fixed-size and variable-size rows, list/grid.
- **\`@tanstack/react-virtual\`** — modern, headless, framework-agnostic. More flexible (you write the markup), more setup.

Both do the same job. Pick \`react-window\` for the fastest setup, \`react-virtual\` when you need full control over the markup.

### 4. What virtualization doesn't fix
- A slow per-row component is still slow when virtualized — virtualization just renders fewer of them. If each row mounts a chart that takes 50ms, scrolling will still hitch. Make the row cheaper first.
- Initial fetch of all 10,000 items still takes the same time. Pair virtualization with **pagination** or **infinite scroll** for very large data.

### 5. Don't reach for it prematurely
A 200-item list does not need virtualization. The setup, the row-height bookkeeping, and the lost native browser features (find-on-page, accessibility patterns) are real costs. Profile first.`,
        codeSnippet: `// === react-window ===
import { FixedSizeList } from 'react-window';

function VirtualList({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={600}        // viewport height
      itemCount={items.length}
      itemSize={48}       // each row is 48px
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          {items[index].name}
        </div>
      )}
    </FixedSizeList>
  );
}

// === @tanstack/react-virtual ===
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

function VirtualListTan({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(v => (
          <div
            key={v.key}
            style={{
              position: 'absolute',
              top: 0,
              transform: \`translateY(\${v.start}px)\`,
              height: v.size,
              width: '100%',
            }}
          >
            {items[v.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}`,
        language: 'tsx',
      },
    ],
  },
];
