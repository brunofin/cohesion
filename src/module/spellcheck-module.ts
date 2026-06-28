import { session } from "electron";
import Module from "./module";
import Settings from "../settings";

const settings = new Settings("spellcheck");

export default class SpellCheckModule extends Module {
    private _enabled: boolean;
    private _languages: string[];

    constructor() {
        super();
        const forcedOff = process.argv.includes("--disable-spellcheck");
        this._enabled = forcedOff ? false : settings.get("enabled", true);
        this._languages = settings.get("languages", []);
    }

    public override beforeLoad() {
        this.apply();
    }

    get enabled(): boolean {
        return this._enabled;
    }

    get languages(): string[] {
        return this._languages;
    }

    setEnabled(val: boolean) {
        this._enabled = val;
        settings.set("enabled", val);
        session.defaultSession.spellCheckerEnabled = val;
    }

    setLanguages(langs: string[]) {
        this._languages = langs;
        settings.set("languages", langs);
        if (langs.length > 0) {
            try {
                session.defaultSession.setSpellCheckerLanguages(langs);
            } catch {
                // language codes may not be available on this system
            }
        }
    }

    getAvailableLanguages(): string[] {
        try {
            return session.defaultSession.availableSpellCheckerLanguages;
        } catch {
            return [];
        }
    }

    private apply() {
        session.defaultSession.spellCheckerEnabled = this._enabled;
        if (this._languages.length > 0) {
            try {
                session.defaultSession.setSpellCheckerLanguages(this._languages);
            } catch {
                // language codes may not be available on this system
            }
        }
    }
}
