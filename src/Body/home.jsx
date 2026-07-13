import '../App.css';

const appJsSource = `import Home from './Body/home'
import './App.css';

function App() {
    return (
        <>
            <Home />
        </>
    );
}

export default App;`;

function Home() {
    return (
        <main className="code-page">
            <section className="code-card">
                <p className="eyebrow">TrackServ</p>
                <h1>App.js source preview</h1>
                <p className="intro">
                    The home page now displays the current <strong>App.js</strong> code.
                </p>
                <pre className="code-block">
                    <code>{appJsSource}</code>
                </pre>
            </section>
        </main>
    );
}

export default Home;