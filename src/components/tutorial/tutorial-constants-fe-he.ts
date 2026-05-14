import { Module } from './tutorial-types';

export const CURRICULUM_FE_HE: Module[] = [
  {
    id: 'react-fundamentals',
    title: 'יסודות React',
    icon: 'Component',
    lessons: [
      {
        id: 'components-props',
        title: 'Components ו-Props',
        description: 'יחידת ה-UI ב-React. איך props זורמים מטה, מדוע composition עדיף על ירושה, והכלל שהופך refactors לבטוחים.',
        content: `### 1. Component הוא פשוט פונקציה
Component ב-React הוא פונקציה שמחזירה JSX. בהינתן אותם קלטים (**props**), הוא יחזיר את אותו ה-UI. זה הכל. אין צורך ב-classes, אין מתודות מחזור-חיים לזכור — React המודרני הוא פונקציונלי.

### 2. Props זורמים בכיוון אחד: כלפי מטה
Props הם קלטים לקריאה בלבד. הורה מעביר נתונים לילד; הילד אינו יכול לשנות את מה שקיבל. זרימה חד-כיוונית זו היא מה שהופך אפליקציות React לניתנות-לדיבוג — כשמשהו נראה לא תקין, אתה עוקב **כלפי מעלה** כדי למצוא את מקור האמת.

- ילד שצריך "לשנות" prop שלו שואל את השאלה הלא נכונה. ה-state חי איפשהו למעלה בעץ, והילד צריך לקרוא ל-callback (שגם הוא מועבר כ-prop) כדי לבקש מהבעלים לעדכן אותו.
- לעולם אל תכתוב \`props.user.name = "..."\`. זה לפעמים יראה שזה עובד ויישבר בשקט מאוחר יותר.

### 3. Composition על פני ירושה
ל-React אין סיפור של \`extends MyComponent\`. במקום זאת, components מתחברים על ידי **רינדור אחד את השני** ועל ידי קבלת \`children\` (או render-prop / slot props). \`<Card>\` לא יורש משום דבר — הוא עוטף כל מה שאתה שם בתוכו.

### 4. שמות וגרנולריות
- שמות Component ב-PascalCase. שמות באותיות קטנות מטופלים כתגיות HTML על ידי JSX.
- פצל component כשחלק ממנו מחזיק state משלו, נעשה בו שימוש חוזר, או שהוא גדול מספיק שעזרת שם תעזור לקורא הבא.
- אל תפצל מוקדם מדי. שלושה חלקי JSX בקובץ אחד זה סבבה. עטיפת \`<TitleText>\` סביב \`<h1>\` היא רעש.`,
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
        title: 'State ו-useState',
        description: 'State מקומי באמצעות ה-useState hook. חוסר-שינוי, פונקציות עדכון, ולמה setState אסינכרוני.',
        content: `### 1. State הוא מה שהופך component לדינמי
Props הם קלטים מבחוץ. **State** הוא הנתונים שה-component מחזיק בבעלותו. \`useState\` מחזיר זוג: הערך הנוכחי, ופונקציית setter לתזמון עדכון.

### 2. עדכוני State הם immutable
אינך משנה את אובייקט ה-state הקיים — אתה נותן ל-React אובייקט **חדש**. React משווה הפניות (\`Object.is\`) כדי להחליט אם לרנדר מחדש. שינוי במקום מדלג על הרינדור-מחדש.

- מערכים: השתמש ב-\`[...arr, item]\`, \`arr.filter(...)\`, \`arr.map(...)\`. לעולם לא \`arr.push(item)\` ואז \`setArr(arr)\`.
- אובייקטים: השתמש ב-\`{ ...obj, key: value }\`. לעולם לא \`obj.key = value\`.

### 3. Setters הם אסינכרוניים
קריאה ל-\`setCount(count + 1)\` אינה משנה את \`count\` מיד. React מקבץ עדכונים ומרנדר מאוחר יותר. אם תקרא \`count\` מיד אחרי, תראה את הערך **הישן**. זו תכונה, לא באג — זה מאפשר ל-React לקבץ הרבה setters לרינדור אחד.

### 4. פונקציות עדכון
כאשר ה-state החדש תלוי ב-state הקודם, השתמש בצורת הפונקציה: \`setCount(prev => prev + 1)\`. זה מבטיח שאתה פועל על הערך העדכני ביותר, גם אם React מקבץ מספר עדכונים.

### 5. State אחד לכל קונספט
אל תדחוס state לא-קשור לתוך אובייקט אחד. \`useState\` לכל קונספט נקרא טוב יותר ומונע דפוסים של "מיזוג כל הדברים" שמגיעים מ-class components.`,
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
        title: 'Effects ו-useEffect',
        description: 'סנכרון עם העולם החיצוני. תזמון effects, מערך התלויות, cleanup, ומתי לא להישען על effect.',
        content: `### 1. למה effect מיועד
\`useEffect\` מיועד **לסנכרון ה-component שלך עם משהו שמחוץ ל-React** — מנוי, טיימר, כותרת המסמך, קריאת analytics. אם העבודה שלך היא רק "חישוב UI מ-props/state", אתה לא צריך effect.

### 2. מערך התלויות
הארגומנט השני שולט מתי ה-effect ירוץ שוב.
- \`[]\` — רץ פעם אחת אחרי mount, ה-cleanup רץ ב-unmount.
- \`[dep1, dep2]\` — רץ אחרי כל רינדור שבו אחת התלויות השתנתה.
- חסר — רץ אחרי כל רינדור. כמעט תמיד טעות.

מערך התלויות **אינו עצה אופציונלית**. אם ה-effect שלך משתמש בערך מ-props/state ואתה לא רושם אותו, תקרא ערכים stale לנצח.

### 3. Cleanup
החזר פונקציה מה-effect שלך כדי לבטל את כל מה שהקמת — בטל מנוי, נקה את הטיימר, בטל את ה-fetch. React קורא ל-cleanup לפני הרצה מחדש של ה-effect וב-unmount. דלג על cleanup ותדלוף listeners.

### 4. מתי **לא** להשתמש ב-effect
- **גזירת state מ-props** — פשוט חשב אותו במהלך הרינדור. \`const fullName = first + ' ' + last\` הוא לא effect.
- **תגובה לאירוע משתמש** — שים את הלוגיקה ב-event handler. effect שמסתכל על state שנקבע על ידי onClick הוא הפניה אחת יותר מדי.
- **איפוס state כש-prop משתנה** — העדף \`key\` prop שמרכיב מחדש את ה-component.

המודל המנטלי: effects הם **escape hatch** לחלקים של האפליקציה שאינם React. השתמש בהם במשורה.`,
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
        title: 'רשימות ו-Keys',
        description: 'למה React צריך keys, מלכודת ה-index-as-key, ואיך זהות יציבה מונעת באגי UI עדינים.',
        content: `### 1. למה keys קיימים
כשאתה מרנדר רשימה, React צריך להתאים כל אלמנט מרונדר לעמית שלו מהרינדור הקודם כדי שידע מה להוסיף, להזיז או להסיר. **Keys הם הזהות** ש-React משתמש בה כדי לבצע התאמה זו.

### 2. מלכודת ה-index-as-key
שימוש ב-index של המערך כ-key עובד רק אם הרשימה היא **append-only ולעולם לא ממוינת מחדש**. ברגע שאתה מכניס בהתחלה, ממיין או מסנן, ה-indices זזים — ו-React חושב שכל פריט השתנה. תראה:
- שדות טופס שמשאירים את הערך הלא נכון אחרי מחיקה
- אנימציות שרצות על כל פריט במקום על החדש
- מצב בחירה שמוצמד לשורה הלא נכונה

### 3. מזהים יציבים וייחודיים
ה-key הנכון הוא **מזהה יציב מהנתונים** — id ממסד נתונים, UUID שנוצר כשהפריט נוצר, או hash תוכן אם הנתונים באמת immutable. צור את ה-id כשאתה יוצר את הפריט, לא כשאתה מרנדר אותו (\`Math.random()\` בתוך render נותן לך key חדש בכל פעם → React חושב שכל פריט הוא חדש בכל רינדור).

### 4. Keys מוגבלים ל-siblings
Keys צריכים להיות ייחודיים רק בין siblings של אותה הרשימה. רשימות מקוננות זה בסדר; אתה לא צריך keys ייחודיים גלובלית.

### 5. Keys לא מועברים ל-component שלך
הפתעה נפוצה: \`key\` נצרך על ידי React. ה-component שלך לא מקבל אותו כ-prop. אם אתה צריך גם את ה-id בתוך ה-component, העבר אותו כ-prop נפרד.`,
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
    title: 'יסודות TypeScript',
    icon: 'FileType2',
    lessons: [
      {
        id: 'typing-props',
        title: 'הגדרת טיפוסים ל-Components ו-Props',
        description: 'ממשקי props, children, הוויכוח על React.FC, והדפוסים שהופכים refactors לחסרי-כאב.',
        content: `### 1. הגדר טיפוסים ל-props במפורש
הגדר \`type\` או \`interface\` ל-props של כל component. טיפוסי אובייקט inline עובדים ל-components קטנים חד-פעמיים, אבל טיפוס בשם משתלם מהרגע שה-component נעשה בשימוש חוזר או שה-props גדלים.

### 2. \`type\` מול \`interface\`
ל-component props, \`type\` הוא ברירת המחדל המודרנית — הוא תומך ב-unions, intersections ו-mapped types בצורה אחידה. \`interface\` גם בסדר; בחר אחד והיה עקבי. אל תערבב אותם באותו קובץ סתם בשביל גיוון.

### 3. \`React.FC\` כבר לא נחוץ
codebases ישנים יותר משתמשים ב-\`const Foo: React.FC<Props> = (props) => ...\`. הקהילה התרחקה מזה:
- הוא מוסיף משתמע \`children\` גם כשה-component שלך לא מקבל אותם
- הוא חוסם generic components
- אתה לא צריך אותו כדי להסיק את טיפוס ההחזרה — TypeScript מבין \`JSX.Element\` בעצמו

פשוט כתוב \`function Foo(props: FooProps) { ... }\` או \`const Foo = (props: FooProps) => ...\`.

### 4. הגדרת טיפוס ל-children
- node גנרי (string, number, JSX, מערך, null): \`React.ReactNode\`
- אלמנט יחיד ספציפית: \`React.ReactElement\`
- ילד שהוא פונקציה (דפוס render-prop): חתימת הפונקציה עצמה

אם ה-component שלך חייב לקבל children, רשום אותם במפורש בטיפוס ה-props. אל תסמוך על wrapper שיוסיף אותם בשבילך.

### 5. הרחבת attributes של HTML
כפתור ש"הוא \`<button>\` עם תוספות" צריך לקבל את כל ה-props המקוריים של button כדי שקוראים יוכלו להעביר \`onClick\`, \`disabled\`, \`aria-*\` וכו' בלי שתצטרך להגדיר כל אחד מחדש.`,
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
        title: 'Hooks עם Generics',
        description: 'הגדרת טיפוסים ל-useState, useRef ו-useReducer. מתי inference מספיק ומתי חובה לציין.',
        content: `### 1. \`useState\` — תן ל-inference לעבוד
\`useState(0)\` מסיק \`number\`. \`useState('')\` מסיק \`string\`. אתה צריך לציין רק כאשר:
- הערך ההתחלתי הוא \`null\` או \`undefined\` אבל הערך הסופי הוא משהו אחר: \`useState<User | null>(null)\`
- ההתחלתי הוא \`[]\` אבל אתה רוצה מערך עם טיפוס: \`useState<Todo[]>([])\`
- union של מספר טיפוסים: \`useState<'idle' | 'loading' | 'error'>('idle')\`

### 2. \`useRef\` — שני שימושים נפרדים, שני דפוסי טיפוס
- **Ref לאלמנט DOM**: \`useRef<HTMLInputElement>(null)\`. ה-\`.current\` הוא מעין-לקריאה-בלבד (מנוהל על ידי React) ומתחיל כ-\`null\` עד ש-React מצמיד את ה-node.
- **Ref כקופסת ערך mutable** (ללא DOM): \`useRef<number>(0)\`. אתה יכול לכתוב ל-\`.current\` בחופשיות — הוא שורד רינדורים בלי לעורר אחד.

### 3. \`useReducer\` — הגדר טיפוס ל-state ול-union של ה-actions
המקום הקלאסי שבו generics זוהרים. הגדר טיפוס \`State\` ו-union של \`Action\`, ואז \`useReducer<Reducer<State, Action>>\`. גוף ה-reducer הופך ל-exhaustive: TypeScript מצמצם את טיפוס ה-action בתוך כל case.

### 4. Custom hooks
custom hook הוא פונקציה ששמה מתחיל ב-\`use\`. הגדר את ערך ההחזרה שלה כ-\`const\` tuple (\`[value, setValue] as const\`) כדי שצרכנים יקבלו \`[T, (v: T) => void]\` במקום \`(T | ((v: T) => void))[]\`.

### 5. אל תגדיר טיפוסים יותר מדי
ה-inference של TypeScript ב-React הוא טוב. הוספת annotation שרק חוזרת על מה ש-TS כבר הסיק היא רעש — והיא מתיישנת כשהמימוש משתנה.`,
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
        title: 'Discriminated Unions לוריאנטים',
        description: 'איך לדגם props שמשתנים לפי וריאנט. הדפוס שהופך באגי runtime לשגיאות קומפילציה.',
        content: `### 1. הבעיה
ל-component יש וריאנטים. \`<Button>\` הוא לפעמים \`primary\`, לפעמים כפתור \`icon\`. וריאנט ה-icon דורש prop \`icon\`; וריאנט ה-primary לא לוקח אחד. עם טיפוס props שטוח אחד, אתה או:
- מסמן את \`icon\` כאופציונלי ומקבל שצרכנים יכולים להעביר אותו לא-נכון (\`<Button variant="primary" icon={...} />\` קומפלץ אבל חסר משמעות), או
- מוסיף בדיקות runtime שמערכת הטיפוסים לא יכולה לעזור איתן.

### 2. הפתרון: discriminated union
הפוך כל וריאנט לטיפוס שלו עם **literal discriminator**, ואז עשה לו union:

\`\`\`ts
type ButtonProps =
  | { variant: 'primary'; label: string }
  | { variant: 'icon'; icon: ReactNode; label: string };
\`\`\`

עכשיו \`<Button variant="icon" />\` היא שגיאת קומפילציה — ה-\`icon\` prop נדרש כשהוריאנט הוא \`'icon'\`. ובתוך ה-component, narrowing לפי \`props.variant\` נותן לך type safety מלאה על השדות הספציפיים לוריאנט.

### 3. Narrowing במימוש
TypeScript מצמצם על ה-discriminator בתוך \`if\` או \`switch\`:

\`\`\`tsx
if (props.variant === 'icon') {
  return <button>{props.icon}{props.label}</button>; // 'icon' בתחום
}
return <button>{props.label}</button>;
\`\`\`

### 4. מתי להישען על זה
- Components עם ערכות props מוציאות זו את זו (controlled מול uncontrolled inputs, link מול button, גדלי modal עם תוכן בצורה שונה)
- צורות תגובה של API (\`{ status: 'ok'; data: T } | { status: 'error'; message: string }\`)
- Reducer actions (ראינו את זה בשיעור הקודם)

### 5. הפשרה
כל וריאנט חדש פירושו ענף חדש ב-union ונתיב קוד חדש. אם הוריאנטים שלך חולקים 95% מה-props שלהם ונבדלים ב-boolean אחד, טיפוס יחיד עם flag אופציונלי הוא בסדר — אל תבנה יתר על המידה.`,
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
    title: 'ניהול State',
    icon: 'Database',
    lessons: [
      {
        id: 'local-lifted-context',
        title: 'מקומי, מורם, Context',
        description: 'שלוש דרגות ה-state ב-React ואיך לבחור ביניהן. רוב האפליקציות צריכות מעט מאוד מעבר לרשימה הזו.',
        content: `### 1. התחל מקומי
ברירת מחדל לכל פיסת state ל-component הקטן ביותר שצריך אותה. \`useState\` בתוך leaf component הוא הזול ביותר, המהיר ביותר והכי פחות מצומד. רוב ה-state באפליקציה טיפוסית שייך לכאן.

### 2. הרם כש-siblings צריכים לחלוק
כששני siblings צריכים את אותו ערך (או שאחד צריך להגיב לאחר), העבר את ה-state לאב הקרוב המשותף ביותר שלהם והעבר אותו מטה כ-props פלוס callback של setter. זהו הדפוס הקלאסי של React וזה מספיק לרוב המקרים.

הסימן שאתה צריך להרים: אתה מוצא את עצמך מנסה לקרוא state מ-sibling. אתה לא יכול — props זורמים מטה. הזז את ה-state למעלה.

### 3. הישען על Context כש-prop drilling הופך כואב
Context אינה ספריית state-management — היא דרך לדלג על העברת props דרך שכבות שלא אכפת להן. השתמש בה ל:
- **Theme / locale / משתמש נוכחי** — ערכים שהרבה components קוראים ומעטים משנים
- **פיסת state משותפת ל-subtree עמוק** — state של טופס שבו 8 fields מקוננים משתמשים, בחירה של עורך שמשתמשים בה ב-toolbar

### 4. שתי העלויות של Context
- **טווח רינדור-מחדש**: כל צרכן של context מתרנדר מחדש כשערך ה-context משתנה. פיצול context גדול אחד למספר קטנים יותר (או שימוש בספריית selectors) מגביל את רדיוס הפיצוץ.
- **עקיפות**: component שקורא מ-context קשה יותר לשימוש חוזר וקשה יותר לבדיקה בבידוד. שלם את העלות הזאת רק כש-prop drilling באמת כואב, לא לכל ערך משותף.

### 5. אל תשים נתוני שרת ב-state של component
נתונים שנשלפו מה-API שלך אינם באמת ה-state "שלך" — הם עותק cached של ה-state של השרת. כלים שתוכננו לזה (React Query, SWR, RTK Query) מטפלים ב-staleness, ב-refetching, ב-deduplication ובמצבי loading בחינם. בנייה ידנית של זה עם \`useState + useEffect\` תמיד נגמרת בסבך.`,
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
        title: 'Stores חיצוניים: Zustand ו-Redux',
        description: 'כש-useState ו-Context לא מספיקים. מה store חיצוני קונה לך ומה הוא עולה.',
        content: `### 1. הטריגר
אתה מושיט יד ל-store חיצוני כאשר:
- אותו state נקרא ונכתב ממקומות רבים רחוקים זה מזה בעץ
- אתה צריך ש-state ישרוד unmounts של components (התקדמות של wizard, טיוטה של טופס)
- רינדורי-מחדש של Context גורמים לבעיות ביצועים אמיתיות
- אתה רוצה debugging של time-travel או middleware (logging, persistence)

אם אף אחד מאלה לא חל, \`useState\` + הרמה + Context קטן זה מספיק. רוב האפליקציות לעולם לא צריכות store.

### 2. Zustand — מינימלי, hooks-first
מספר עשרות שורות של API. אתה מגדיר store כ-hook, components נרשמים ל-slices. אין צורך ב-provider, אין boilerplate של actions/reducers. הפשרה: פחות מבנה, קל יותר לעשות בלגן ב-codebase גדול אם לא נאכפים מוסכמות.

### 3. Redux Toolkit — מובנה, דעתני
ה-Redux המודרני. Slices עוטפים פיסת state עם ה-reducers שלה. RTK Query מוסיף שכבת cache של state-שרת מעל. הפשרה: יותר קבצים, יותר מושגים, יותר "חשיבת Redux" — שווה את זה בצוותים גדולים שבהם המבנה משתלם.

### 4. Selectors ושוויון
שתי הספריות מאפשרות לך להירשם ל-**slice** של ה-store במקום לכל הדבר. selector שמחזיר אובייקט חדש בכל רינדור (למשל \`s => ({ a: s.a, b: s.b })\`) מנטרל את האופטימיזציה — ה-component מתרנדר מחדש בכל שינוי store. השתמש ב-shallow equality, או פצל למספר selectors.

### 5. המסקנה המשעממת
בחר אחד והיה עקבי. הספרייה משנה פחות מהמשמעת של:
- שימת state **משותף, מתמשך** בלבד ב-store
- שמירה של state UI מקומי כמקומי
- אי שכפול של state שרת ל-store — תן לשכבת data-fetching שלך לעשות את ה-cache`,
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
        title: 'State נגזר',
        description: 'אל תאחסן את מה שאתה יכול לחשב. State משוכפל הוא המקור של חצי מהבאגים ב-codebase טיפוסי של React.',
        content: `### 1. העיקרון
אם ערך יכול **להיחשב מ-state אחר או מ-props**, אל תאחסן אותו. חשב אותו במהלך הרינדור. state נגזר מאוחסן בהכרח יוצא מסנכרון עם המקור שלו — מחלקת הבאגים שבה הסכום המוצג לא תואם את הפריטים בעגלה.

### 2. דוגמאות ל-state נגזר למחיקה
- \`fullName\` מאוחסן בנפרד מ-\`firstName\` ו-\`lastName\` → \`const fullName = first + ' ' + last\` במהלך הרינדור
- \`itemCount\` מאוחסן ליד \`items\` → \`items.length\`
- boolean \`isValid\` מאוחסן ליד שדות הטופס → חשב מהשדות בכל רינדור
- מערך \`filteredItems\` מאוחסן בנפרד מ-\`items\` ו-\`filter\` → \`const filtered = items.filter(...)\` במהלך הרינדור

### 3. "אבל זה לא בזבזני?"
React מהיר. חישוב מחדש של \`items.length\` או סינון מערך של 100 פריטים בכל רינדור הם **בלתי-נראים**. בצע אופטימיזציה כשאתה מודד בעיה, לא לפני. ואם החישוב באמת יקר, \`useMemo\` מאפשר לך לשמור ב-cache בלי לאחסן — ראה את המודול הבא.

### 4. מקור אמת יחיד
כל פיסת state צריכה לחיות ב**מקום אחד בלבד**. אם אתה מוצא את עצמך כותב "כש-X משתנה, גם עדכן את Y", Y הוא כנראה state נגזר בתחפושת. מחק את Y.

### 5. החריג: cache בין רינדורים
\`useMemo\` הוא לחישובים **יקרים** או לשמירת שוויון הפניה יציב ל-components ממומורזים שמתחתיו. הוא אינו מקום לשים בו state. תוצאת \`useMemo\` מחושבת מחדש כש-deps שלה משתנות — זה עדיין נגזר, רק cached.`,
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
    title: 'ביצועים ורינדור',
    icon: 'Zap',
    lessons: [
      {
        id: 're-render-model',
        title: 'איך React מרנדר מחדש',
        description: 'המודל המנטלי: מה מפעיל רינדור-מחדש, איך הוא מתפשט, ולמה "זה איטי" כמעט תמיד הוא בעיית מדידה.',
        content: `### 1. מה מפעיל רינדור-מחדש
component מתרנדר מחדש כאשר אחד משלושה דברים קורה:
- ה-**state** שלו משתנה (נקרא setter עם ערך חדש)
- ה-**הורה שלו מתרנדר מחדש** (ולא העביר דרך memo)
- **context** שהוא צורך משנה ערך

שינוי props **אינו** טריגר נפרד — props משתנים כי ההורה התרנדר מחדש והעביר חדשים. במעקב אחרי השרשרת מעלה, כל רינדור-מחדש מתחיל בשינוי state או בעדכון context איפשהו.

### 2. התפשטות רינדור-מחדש
כברירת מחדל, כש-component מתרנדר מחדש, **כל ילדיו מתרנדרים מחדש גם כן** — אפילו ילדים ש-props שלהם לא השתנו. זה נשמע יקר אבל בדרך כלל אינו. ה-reconciliation של React הוא מהיר מאוד, ועדכוני ה-DOM האמיתיים קורים רק לדברים שבאמת השתנו.

### 3. "רינדור-מחדש" לא אומר "עדכון DOM"
זה הבלבול הנפוץ ביותר. React מרנדר מחדש את ה-component (קורא לפונקציה, בונה עץ וירטואלי חדש), ואז **משווה** מול העץ הקודם. רק ההבדלים מגיעים ל-DOM. רינדור-מחדש שמייצר פלט זהה עולה כמעט כלום.

### 4. מתי באמת לדאוג
פרופיל קודם. פתח את ה-React DevTools Profiler, הקלט אינטראקציה, ומצא את ה-components שלוקחים זמן אמיתי. כמעט תמיד:
- חופן components שולטים בעלות
- התיקון הוא שינוי קטן יותר ממה שציפית (key חסר, context גדול מדי, חישוב יקר שצריך להיות ממומורז)

### 5. שתי מלכודות הביצועים האמיתיות
- **רינדורי-מחדש של context גדול**: context עם הרבה צרכנים, שבו שינוי קטן מרנדר מחדש את העולם. פצל את ה-context.
- **חישובים יקרים בכל רינדור**: סינון רשימה של 50,000 פריטים, פירוס blob ענק. \`useMemo\` (השיעור הבא) מטפל באלה.

מימוזציה מוקדמת מוסיפה מורכבות בלי תועלת. מדוד, ואז עשה אופטימיזציה.`,
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
        description: 'מה כל אחד עושה, מלכודת שוויון ההפניה, ואיך לזהות מתי מימוזציה מחמירה את המצב.',
        content: `### 1. שלושת הכלים
- **\`React.memo(Component)\`** — עוטף component כך שידלג על רינדור-מחדש כש-props שלו שווי-הפניה ל-props של הרינדור הקודם
- **\`useMemo(fn, deps)\`** — שומר ב-cache את **התוצאה** של \`fn()\` ומחזיר את אותה ההפניה עד ש-\`deps\` משתנות
- **\`useCallback(fn, deps)\`** — שומר ב-cache את **הפונקציה עצמה** ומחזיר את אותה ההפניה עד ש-\`deps\` משתנות. (מילולית זה \`useMemo(() => fn, deps)\`.)

כל השלושה עוסקים בשמירת **שוויון הפניה** כדי שילדים ממומורזים יוכלו לדלג על עבודה.

### 2. למה מימוזציה לעיתים קרובות נכשלת
\`React.memo\` משווה props עם \`Object.is\`. ברגע שהורה מעביר אובייקט, מערך או פונקציה שנוצרו טריים כ-prop, ההשוואה נכשלת ו-\`memo\` מתרנדר מחדש בכל זאת:

\`\`\`tsx
<Child config={{ size: 'lg' }} />        // אובייקט חדש בכל רינדור
<Child onClick={() => doThing()} />      // פונקציה חדשה בכל רינדור
<Child items={data.map(...)} />          // מערך חדש בכל רינדור
\`\`\`

כדי לגרום ל-\`memo\` לדלג באמת, אתה צריך \`useMemo\` ל-props של אובייקטים/מערכים ו-\`useCallback\` ל-props של פונקציות בצד ההורה.

### 3. מתי מימוזציה היא הפסד נטו
למימוזציה עצמה יש עלות: שמירת ה-deps הקודמים, השוואתם, והעומס המנטלי של קריאת הקוד. ל-component זול שמקבל props זולים, \`React.memo\` עולה יותר ממה שהוא חוסך.

יישם מימוזציה ל:
- Components שמרנדרים תתי-עצים גדולים
- Components ברשימות ארוכות
- חישובים שלוקחים זמן מדיד (parse, sort, filter על קלטים גדולים)

דלג על מימוזציה ל:
- Leaf components שמרנדרים מספר אלמנטים
- כל מה שלא פרופלת

### 4. הכלל
אל תמומורז מתוך הגנה. מומורז **אחרי** שהפרופיל אומר לך. צוות React אמר זאת במשך שנים; ה-codebases שמתעלמים מזה נגמרים עם \`useCallback\` ו-\`useMemo\` על כל פונקציה וערך, ובלי שיפור מדיד.

### 5. ה-React Compiler משנה זאת
React Compiler המתקרב מבצע מימוזציה אוטומטית. codebases שמכוונים ל-compiler יכולים להפסיק להושיט יד ידנית לאלה. עד שאתה עליו, הכללים למעלה תקפים.`,
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
        title: 'רשימות ארוכות ו-Virtualization',
        description: 'כשרשימה הופכת ארוכה מספיק שרינדור של כולה הוא הצוואר הבקבוק. הפתרון ואיך לדעת שאתה צריך אותו.',
        content: `### 1. הסף
רינדור רשימה של 100 פריטים: מהיר. 1,000 פריטים עם שורות פשוטות: בדרך כלל עדיין בסדר. 10,000 פריטים עם תוכן עשיר: איטי בצורה גלויה. המספר המדויק תלוי במורכבות השורה — רשימה של מחרוזות פשוטות סובלת יותר פריטים מרשימה של כרטיסים עם תמונות וכפתורים.

אם הרשימה שלך **מתפגרת בגלילה**, **קופצת כשפריטים נוספים**, או **לוקחת רגע מורגש להיטען**, חצית את הסף.

### 2. הפתרון: virtualization
Virtualization מרנדר רק את השורות הנראות כרגע ב-viewport (פלוס overscan קטן מעל ומתחת). כשהמשתמש גולל, שורות נכנסות ויוצאות מה-DOM. הרשימה **נראית** כאילו כל 10,000 הפריטים שם, אבל ה-DOM מחזיק אולי 30.

הפשרה: לשורות צריך להיות גובה ידוע או מדיד, ודפוסים מסוימים (\`Cmd-F\` של דפדפן, screen readers שעוברים על הרשימה, scroll-to-element נטיבי) דורשים תשומת לב נוספת.

### 3. הספריות
- **\`react-window\`** — קטנה, ממוקדת, המקורית. שורות בגודל קבוע ושורות בגודל משתנה, list/grid.
- **\`@tanstack/react-virtual\`** — מודרנית, headless, אגנוסטית ל-framework. גמישה יותר (אתה כותב את ה-markup), הקמה יותר.

שתיהן עושות אותה עבודה. בחר \`react-window\` להקמה הכי מהירה, \`react-virtual\` כשאתה צריך שליטה מלאה על ה-markup.

### 4. מה ש-virtualization לא מתקן
- component שורה איטי הוא עדיין איטי כשהוא מ-virtualized — virtualization פשוט מרנדר פחות מהם. אם כל שורה מרכיבה chart שלוקח 50ms, גלילה עדיין תהיה תקועה. עשה את השורה זולה יותר קודם.
- שליפה ראשונית של כל 10,000 הפריטים עדיין לוקחת את אותו הזמן. שלב virtualization עם **pagination** או **infinite scroll** לנתונים גדולים מאוד.

### 5. אל תמהר להישען על זה
רשימה של 200 פריטים אינה צריכה virtualization. ההקמה, ה-bookkeeping של גובה השורות ויכולות הדפדפן הנטיביות שאובדות (find-on-page, דפוסי נגישות) הן עלויות אמיתיות. פרופלת קודם.`,
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
