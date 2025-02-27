/**
 * @file source/Chrome - Webkit Extension API Wrapper.
 *
 * Webkit Extension API wrapper using ES6 features - promises, accessors and 
 * classes. Levels differences between different Webkit implementations (Opera,
 * Chrome). Also adds some useful features of its own (settings management, tab
 * management, fetch for extension-local files, language switching, etc.)
 *
 */

import { I18n, I18nKey, LocalSettings, Settings } from "./Settings";

/**
 * @brief Modernizes Chrome Extension API system function.
 *
 * Helper function. Modernizes Chrome's API system call. Binds function to it's
 * parent \p namespace. Converts return-by-callback behavior to
 * return-by-promise behavior.
 * 
 * Exception Safety: Strong. Will throw if specified namespace/key is not a 
 * function
 *
 * @param namespace: Object parent of bound function
 * @param funcKey: String name of the function in the namespace. Function must
 * return value by callback
 * @throw Error: Function throws \c Error if \c namespace[funcKey] is not a
 * function
 * @return Function: wrapped function returning Promise to value previously
 * returned by callback
 */

const Chrome = {

/**
 * @brief Creates I18n function. I18n function returns locale message held under
 * I18n key.
 * Exception-Safety: No-Throw
 * Promise Exception-Safety: Strong Guarantee. Will throw if File-related
 * errors occur
 * @param locale String: Optional ID of the locale ex: en, en-gb, de
 * @return Promise: to Locale Map
 */
async getI18n(locale? : string) : Promise<I18n> {
	// default locale - use default chrome locale engine
	if (!locale)
		return chrome.i18n.getMessage.bind(chrome.i18n);
	// custom set to english - load only english
	if (locale == "en") {
		const json = await Chrome.fetch("_locales/en/messages.json")
		const locale : { [key : string] : { message : string } } = JSON.parse(json);
		return (messageKey : string) => locale[messageKey]?.message ?? "";
	}
	// custom set to non-english, english fallback
	const [curLocale, enLocale] = (await Promise.all([
		Chrome.fetch(`_locales/${locale}/messages.json`),
		Chrome.fetch("_locales/en/messages.json")
	])).map(json => JSON.parse(json))
	return (messageKey : I18nKey) =>
		(curLocale[messageKey] ?? enLocale[messageKey])?.message ?? "";
},

/**
 * @brief Returns name of the platform
 * @note Exception Safety: No-Throw
 * @return String: Returns \c "Windows" on Windows platforms and \c "Ubuntu" on
 * Linux Platforms. Returns empty string otherwise.
 */
getPlatform() {
	if (navigator.appVersion.indexOf("Win") != -1)
		return "Windows";
	else if (navigator.appVersion.indexOf("Linux") != -1)
		return "Ubuntu";
	else return "";
},

get isEdge() {
	return navigator.appVersion.indexOf("Edg/") !== -1;
},

/**
 * @brief \c fetch for extension-local files
 * @note Exception Safety: No-Throw
 * @note Promise Exception Safety: Promise will reject if file cannot be fetched
 * @param url String: path to the fetched file
 * @return: Promise Function returns Promise of string contents of the file
 */
fetch : (url : string) : Promise<string> => new Promise((resolve, reject) => {
	const xhr = new XMLHttpRequest();
	xhr.open("GET", url);
	xhr.onload = function () {
		this.status >= 200 && this.status < 300
			? resolve(xhr.response)
			: reject(xhr.statusText);
	}
	xhr.onerror = () => { reject(xhr.statusText) }
	xhr.send();
}),

history: {

	/**
	 * @brief Equivalent to chrome.history.search. Callback result will be
	 * forwarded to returned promise
	 * @param query Object: Search query object literal. Properties:
	 * - text String: search string
	 * - startDate Number: Optional beginning of the date range
	 * - endDate Number: Optional end of the date range
	 * - maxResults Number: Optional maximum number of results. Defaults to 100
	 * @throw Error: Throws if object literal is missing or contains invalid
	 * values
	 * @return Promise: Function returns a Promise of search results
	 */
	search: (query : chrome.history.HistoryQuery) =>
		new Promise<chrome.history.HistoryItem[]>(resolve => chrome.history.search(query, resolve)),

	/**
	 * @brief Equivalent to chrome.history.deleteUrl. Callback result will be
	 * forwarded to returned promise
	 * @return Promise: Function returns empty Promise resolved after history
	 * entry gets deleted
	 */
	deleteUrl: (url : chrome.history.Url) =>
		new Promise<void>(resolve => chrome.history.deleteUrl(url, resolve)),
}, // namespace Chrome.history

sessions: {

	/**
	 * @brief Equivalent to chrome.sessions.getRecentlyClosed. Callback result
	 * will be forwarded to returned promise
	 * @return Promise: Function returns Promise of an array of recently closed 
	 * tabs
	 */
	getRecent: (filter : chrome.sessions.Filter) =>
		new Promise<chrome.sessions.Session[]>(resolve => chrome.sessions.getRecentlyClosed(filter, resolve)),

	/**
	 * @brief Equivalent to chrome.sessions.getDevices Callback result will be
	 * forwarded to returned promise
	 * @return Promise of an array of devices
	 */
	getDevices: () =>
		new Promise<chrome.sessions.Device[]>(resolve => chrome.sessions.getDevices(resolve)),
	
	/**
	 * @brief Restores specified session optionally in background
	 * @note Exception Safety: No-Throw.
	 * @note Promise Exception Safety: Strong. If session doesn't exist promise 
	 * will reject.
	 * @param sessionId String: ID of the session to restore
	 * @param inBackground Boolean: Optional. If specified, tab will be restored
	 * in background
	 * @return Promise: Returns promise that will be resolved after session gets
	 * restored.
	 */
	restore(sessionId : string, inBackground? : boolean) {
		return new Promise<void>(resolve => {
			if (inBackground) {
				chrome.tabs.query(({active : true}), tabs => {
					const tab = tabs[0]
					if (tab) {
						chrome.sessions.restore(sessionId, () => {
							chrome.tabs.update(tab.id, {active: true}, () => resolve());
						});
					}
				})
			} else {
				chrome.sessions.restore(sessionId, () => resolve()); // resolve just in case
			}
		});
	}
}, // namespace Chrome.sessions

storage: {

	local: {

		/**
		 * @brief Equivalent to chrome.storage.local.get Callback result will
		 * be forwarded to returned promise
		 * @param Array: Optional array of keys to fetch
		 * @return Promise: Promise of map of storage's local variables
		 */
		get: () => new Promise<any>(resolve => chrome.storage.local.get(resolve)),
		/**
		 * @brief Equivalent to chrome.storage.local.set Callback result will
		 * be forwarded to returned promise
		 * @param Object: Map-like object literal containing values to be set
		 * @return Promise: Empty promise that will be resolved after all
		 * properties are set.
		 */
		set: (items : Object) =>
			new Promise<void>(resolve => chrome.storage.local.set(items, resolve)),
	}, // namespace Chrome.storage.local

	sync: {

		/**
		 * @brief Equivalent to chrome.storage.sync.get Callback result will
		 * be forwarded to returned promise
		 * @note Opera Browser doesn't synchronize its sync storage
		 * @param Array: Optional array of keys to fetch
		 * @return Promise: Promise of map of storage's local variables
		 */
		get: () => new Promise<any>(resolve => chrome.storage.sync.get(resolve)),

		/**
		 * @brief Equivalent to chrome.storage.sync.set Callback result will
		 * be forwarded to returned promise
		 * @note Opera Browser doesn't synchronize its sync storage
		 * @param Object: Map-like object literal containing values to be set
		 * @return Promise: Empty promise that will be resolved after all
		 * properties are set.
		 */
		set: (items : Object) =>
			new Promise<void>(resolve => chrome.storage.sync.set(items, resolve)),
	} // namespace Chrome.storage.sync
}, // namespace Chrome.storage

settings: {

	/**
	 * @brief Obtains read-only Settings object.
	 * @note Exception Safety: No-throw
	 * @note Promise Exception Safety: Strong Guarantee
	 * @note Settings object shares its keys with local and sync storage. Be 
	 * cauctious when used in conjuction with Chrome.storage API. Local 
	 * storage's \c local property is used for switching between local and sync
	 * settings
	 * @param defaultSttings Object: Optional object literal containing default 
	 * settings that will be used as template if no settings are set yet.
	 * @return Promise: Function returns promise of settings object literal
	 */
	async getReadOnly(defaultSettings : Settings = {}) : Promise<Settings> {
		const [ local, sync ] : [ LocalSettings, Settings ] = await Promise.all([
			Chrome.storage.local.get(),
			Chrome.storage.sync.get()
		])
		const settings = local.local ? local : sync;
		return { ...defaultSettings, ...settings }
	}, 

	/**
	 * @brief Placeholder Function
	 */
	getReadWrite() {
		throw new Error("Called Placeholder Function");
		
	}
}, // namespace Chrome.settings

tabs : {

	/**
	 * @brief Equivalent to chrome.tabs.create.
	 * @param properties Object: Object literal containing properties of newly
	 * created tab
	 * @return Promise: Function returns empty promise that will be resolved
	 * once tab is created
	 */
	create: (options : chrome.tabs.CreateProperties) => new Promise<chrome.tabs.Tab>(resolve => chrome.tabs.create(options, resolve)),

	/**
	 * @brief Equivalent to chrome.tabs.query.
	 * @param properties Object: Object literal containing properties of tab 
	 * to be found
	 * @return Promise: Function returns promise of Array of found tabs
	 */
	query: (query : chrome.tabs.QueryInfo) => new Promise<chrome.tabs.Tab[]>(resolve => chrome.tabs.query(query, resolve)),

	/**
	 * @brief Equivalent to chrome.tabs.create.
	 * @param properties Object: Object literal containing properties of updated
	 * tab
	 * @return Promise: Function returns empty promise that will be resolved
	 * once tab is updated
	 */
	update: (id : number, properties : chrome.tabs.UpdateProperties) => new Promise<chrome.tabs.Tab>(resolve => chrome.tabs.update(id, properties, resolve)),

	/**
	 * @brief Equivalent to chrome.tabs.create.
	 * @param properties Object: Object literal containing ids of tabs to 
	 * highlight
	 * @return Promise: Function returns empty promise that will be resolved
	 * once tab is created
	 */
	highlight: (info : chrome.tabs.HighlightInfo) => new Promise<chrome.windows.Window>(resolve => chrome.tabs.highlight(info, resolve)),

	async openInCurrentTab(url : string, inBackground : boolean) {
		console.log("here")
		const { id : windowId } = await Chrome.windows.getCurrent();
		if (!inBackground) {
			const [ active ] = await new Promise<chrome.tabs.Tab[]>(resolve => chrome.tabs.query({ active : true, windowId }, x => resolve(x)));
			if (active) {
				return await new Promise(resolve => chrome.tabs.update(active.id, {url : url}, x => resolve(x)))
			}
		}
		return Chrome.tabs.create({
			windowId,
			url: url,
			active: !inBackground
		});
	},

	/**
	 * @brief Creates new tab in current active window, specified by supplied 
	 * URL without closing extension popup. Optionally creates it in background.
	 * If tab with specified URL already exists, selects this tab.
	 * @note Exception Safety: No-Throw
	 * @note Promise Exception Safety: No-Throw
	 * @note might close popup in Goolge Chrome
	 * @param url String: URL of newly created tab.
	 * @param inBackground Boolean: Optional. Create background tab.
	 */
	// open url or if tab with URL already exists, select it instead
	// Only consider the current window
	async openOrSelect(url : string, inBackground : boolean) {
		const colon = url.indexOf(":");
		if (colon >= 0) {
			// external URL (has comma)
			const pattern = "*" + url.substr(colon);
			const { id : windowId } = await Chrome.windows.getCurrent();
			const tabs = await Chrome.tabs.query({url: pattern, windowId})
			console.log(tabs)
			if (tabs.length) {
				if (inBackground)
					return Chrome.tabs.highlight({
						tabs: tabs.map(tab => tab.index)
					});		
				else return Chrome.tabs.update(
					tabs[0].id, 
					{ active: true }
				);
			} else {
				return Chrome.tabs.openInCurrentTab(url, inBackground);
			}
		} else {
			// extension-local URL
			return Chrome.tabs.openInCurrentTab(url, inBackground);
		}
	},
}, // namespace Chrome.tabs
windows : {
	getCurrent : () => new Promise<chrome.windows.Window>(resolve => chrome.windows.getCurrent(x => resolve(x)))
}, // namespace Chrome.windows
bookmarks : {
	getTree : () => new Promise<chrome.bookmarks.BookmarkTreeNode[]>(resolve => chrome.bookmarks.getTree(resolve))
},
theme : {
	get isDarkTheme() {
		return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
	},
	async updateIcon() {
		const settings = await Chrome.settings.getReadOnly({icon: "auto"})
		const icon =
			settings.icon === "auto"
			? (Chrome.theme.isDarkTheme ? "white" : "granite")
			: settings.icon;
		chrome.browserAction.setIcon({
			path: `icons/history-19-${icon}.png`
		})
	},
	updateTheme() {
		if (Chrome.isEdge) {
			document.body.classList.add("Edge");
		}
		Chrome.theme.updateIcon();
	}
}
} // namespace Chrome

export default Chrome
