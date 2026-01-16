(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&n(i)}).observe(document,{childList:!0,subtree:!0});function r(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(s){if(s.ep)return;s.ep=!0;const a=r(s);fetch(s.href,a)}})();const te=()=>{};var N={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const W=function(t){const e=[];let r=0;for(let n=0;n<t.length;n++){let s=t.charCodeAt(n);s<128?e[r++]=s:s<2048?(e[r++]=s>>6|192,e[r++]=s&63|128):(s&64512)===55296&&n+1<t.length&&(t.charCodeAt(n+1)&64512)===56320?(s=65536+((s&1023)<<10)+(t.charCodeAt(++n)&1023),e[r++]=s>>18|240,e[r++]=s>>12&63|128,e[r++]=s>>6&63|128,e[r++]=s&63|128):(e[r++]=s>>12|224,e[r++]=s>>6&63|128,e[r++]=s&63|128)}return e},re=function(t){const e=[];let r=0,n=0;for(;r<t.length;){const s=t[r++];if(s<128)e[n++]=String.fromCharCode(s);else if(s>191&&s<224){const a=t[r++];e[n++]=String.fromCharCode((s&31)<<6|a&63)}else if(s>239&&s<365){const a=t[r++],i=t[r++],l=t[r++],c=((s&7)<<18|(a&63)<<12|(i&63)<<6|l&63)-65536;e[n++]=String.fromCharCode(55296+(c>>10)),e[n++]=String.fromCharCode(56320+(c&1023))}else{const a=t[r++],i=t[r++];e[n++]=String.fromCharCode((s&15)<<12|(a&63)<<6|i&63)}}return e.join("")},G={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();const r=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,n=[];for(let s=0;s<t.length;s+=3){const a=t[s],i=s+1<t.length,l=i?t[s+1]:0,c=s+2<t.length,h=c?t[s+2]:0,U=a>>2,g=(a&3)<<4|l>>4;let y=(l&15)<<2|h>>6,w=h&63;c||(w=64,i||(y=64)),n.push(r[U],r[g],r[y],r[w])}return n.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(W(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):re(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();const r=e?this.charToByteMapWebSafe_:this.charToByteMap_,n=[];for(let s=0;s<t.length;){const a=r[t.charAt(s++)],l=s<t.length?r[t.charAt(s)]:0;++s;const h=s<t.length?r[t.charAt(s)]:64;++s;const g=s<t.length?r[t.charAt(s)]:64;if(++s,a==null||l==null||h==null||g==null)throw new ne;const y=a<<2|l>>4;if(n.push(y),h!==64){const w=l<<4&240|h>>2;if(n.push(w),g!==64){const ee=h<<6&192|g;n.push(ee)}}}return n},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}};class ne extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const se=function(t){const e=W(t);return G.encodeByteArray(e,!0)},K=function(t){return se(t).replace(/\./g,"")},ae=function(t){try{return G.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ie(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oe=()=>ie().__FIREBASE_DEFAULTS__,ce=()=>{if(typeof process>"u"||typeof N>"u")return;const t=N.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},le=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=t&&ae(t[1]);return e&&JSON.parse(e)},he=()=>{try{return te()||oe()||ce()||le()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},de=()=>{var t;return(t=he())==null?void 0:t.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fe{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,r)=>{this.resolve=e,this.reject=r})}wrapCallback(e){return(r,n)=>{r?this.reject(r):this.resolve(n),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(r):e(r,n))}}}function ue(){try{return typeof indexedDB=="object"}catch{return!1}}function pe(){return new Promise((t,e)=>{try{let r=!0;const n="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(n);s.onsuccess=()=>{s.result.close(),r||self.indexedDB.deleteDatabase(n),t(!0)},s.onupgradeneeded=()=>{r=!1},s.onerror=()=>{var a;e(((a=s.error)==null?void 0:a.message)||"")}}catch(r){e(r)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ge="FirebaseError";class b extends Error{constructor(e,r,n){super(r),this.code=e,this.customData=n,this.name=ge,Object.setPrototypeOf(this,b.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,J.prototype.create)}}class J{constructor(e,r,n){this.service=e,this.serviceName=r,this.errors=n}create(e,...r){const n=r[0]||{},s=`${this.service}/${e}`,a=this.errors[e],i=a?me(a,n):"Error",l=`${this.serviceName}: ${i} (${s}).`;return new b(s,l,n)}}function me(t,e){return t.replace(be,(r,n)=>{const s=e[n];return s!=null?String(s):`<${n}?>`})}const be=/\{\$([^}]+)}/g;function C(t,e){if(t===e)return!0;const r=Object.keys(t),n=Object.keys(e);for(const s of r){if(!n.includes(s))return!1;const a=t[s],i=e[s];if(P(a)&&P(i)){if(!C(a,i))return!1}else if(a!==i)return!1}for(const s of n)if(!r.includes(s))return!1;return!0}function P(t){return t!==null&&typeof t=="object"}class _{constructor(e,r,n){this.name=e,this.instanceFactory=r,this.type=n,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const u="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ye{constructor(e,r){this.name=e,this.container=r,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const r=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(r)){const n=new fe;if(this.instancesDeferred.set(r,n),this.isInitialized(r)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:r});s&&n.resolve(s)}catch{}}return this.instancesDeferred.get(r).promise}getImmediate(e){const r=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),n=(e==null?void 0:e.optional)??!1;if(this.isInitialized(r)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:r})}catch(s){if(n)return null;throw s}else{if(n)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(Ee(e))try{this.getOrInitializeService({instanceIdentifier:u})}catch{}for(const[r,n]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(r);try{const a=this.getOrInitializeService({instanceIdentifier:s});n.resolve(a)}catch{}}}}clearInstance(e=u){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(r=>"INTERNAL"in r).map(r=>r.INTERNAL.delete()),...e.filter(r=>"_delete"in r).map(r=>r._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=u){return this.instances.has(e)}getOptions(e=u){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:r={}}=e,n=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(n))throw Error(`${this.name}(${n}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:n,options:r});for(const[a,i]of this.instancesDeferred.entries()){const l=this.normalizeInstanceIdentifier(a);n===l&&i.resolve(s)}return s}onInit(e,r){const n=this.normalizeInstanceIdentifier(r),s=this.onInitCallbacks.get(n)??new Set;s.add(e),this.onInitCallbacks.set(n,s);const a=this.instances.get(n);return a&&e(a,n),()=>{s.delete(e)}}invokeOnInitCallbacks(e,r){const n=this.onInitCallbacks.get(r);if(n)for(const s of n)try{s(e,r)}catch{}}getOrInitializeService({instanceIdentifier:e,options:r={}}){let n=this.instances.get(e);if(!n&&this.component&&(n=this.component.instanceFactory(this.container,{instanceIdentifier:we(e),options:r}),this.instances.set(e,n),this.instancesOptions.set(e,r),this.invokeOnInitCallbacks(n,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,n)}catch{}return n||null}normalizeInstanceIdentifier(e=u){return this.component?this.component.multipleInstances?e:u:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function we(t){return t===u?void 0:t}function Ee(t){return t.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _e{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const r=this.getProvider(e.name);if(r.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);r.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const r=new ye(e,this);return this.providers.set(e,r),r}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var o;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(o||(o={}));const De={debug:o.DEBUG,verbose:o.VERBOSE,info:o.INFO,warn:o.WARN,error:o.ERROR,silent:o.SILENT},Ie=o.INFO,Se={[o.DEBUG]:"log",[o.VERBOSE]:"log",[o.INFO]:"info",[o.WARN]:"warn",[o.ERROR]:"error"},Ae=(t,e,...r)=>{if(e<t.logLevel)return;const n=new Date().toISOString(),s=Se[e];if(s)console[s](`[${n}]  ${t.name}:`,...r);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Ce{constructor(e){this.name=e,this._logLevel=Ie,this._logHandler=Ae,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in o))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?De[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,o.DEBUG,...e),this._logHandler(this,o.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,o.VERBOSE,...e),this._logHandler(this,o.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,o.INFO,...e),this._logHandler(this,o.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,o.WARN,...e),this._logHandler(this,o.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,o.ERROR,...e),this._logHandler(this,o.ERROR,...e)}}const Be=(t,e)=>e.some(r=>t instanceof r);let F,L;function ve(){return F||(F=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Oe(){return L||(L=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Y=new WeakMap,B=new WeakMap,X=new WeakMap,D=new WeakMap,$=new WeakMap;function Te(t){const e=new Promise((r,n)=>{const s=()=>{t.removeEventListener("success",a),t.removeEventListener("error",i)},a=()=>{r(f(t.result)),s()},i=()=>{n(t.error),s()};t.addEventListener("success",a),t.addEventListener("error",i)});return e.then(r=>{r instanceof IDBCursor&&Y.set(r,t)}).catch(()=>{}),$.set(e,t),e}function Me(t){if(B.has(t))return;const e=new Promise((r,n)=>{const s=()=>{t.removeEventListener("complete",a),t.removeEventListener("error",i),t.removeEventListener("abort",i)},a=()=>{r(),s()},i=()=>{n(t.error||new DOMException("AbortError","AbortError")),s()};t.addEventListener("complete",a),t.addEventListener("error",i),t.addEventListener("abort",i)});B.set(t,e)}let v={get(t,e,r){if(t instanceof IDBTransaction){if(e==="done")return B.get(t);if(e==="objectStoreNames")return t.objectStoreNames||X.get(t);if(e==="store")return r.objectStoreNames[1]?void 0:r.objectStore(r.objectStoreNames[0])}return f(t[e])},set(t,e,r){return t[e]=r,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function Re(t){v=t(v)}function $e(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...r){const n=t.call(I(this),e,...r);return X.set(n,e.sort?e.sort():[e]),f(n)}:Oe().includes(t)?function(...e){return t.apply(I(this),e),f(Y.get(this))}:function(...e){return f(t.apply(I(this),e))}}function Ue(t){return typeof t=="function"?$e(t):(t instanceof IDBTransaction&&Me(t),Be(t,ve())?new Proxy(t,v):t)}function f(t){if(t instanceof IDBRequest)return Te(t);if(D.has(t))return D.get(t);const e=Ue(t);return e!==t&&(D.set(t,e),$.set(e,t)),e}const I=t=>$.get(t);function Ne(t,e,{blocked:r,upgrade:n,blocking:s,terminated:a}={}){const i=indexedDB.open(t,e),l=f(i);return n&&i.addEventListener("upgradeneeded",c=>{n(f(i.result),c.oldVersion,c.newVersion,f(i.transaction),c)}),r&&i.addEventListener("blocked",c=>r(c.oldVersion,c.newVersion,c)),l.then(c=>{a&&c.addEventListener("close",()=>a()),s&&c.addEventListener("versionchange",h=>s(h.oldVersion,h.newVersion,h))}).catch(()=>{}),l}const Pe=["get","getKey","getAll","getAllKeys","count"],Fe=["put","add","delete","clear"],S=new Map;function H(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(S.get(e))return S.get(e);const r=e.replace(/FromIndex$/,""),n=e!==r,s=Fe.includes(r);if(!(r in(n?IDBIndex:IDBObjectStore).prototype)||!(s||Pe.includes(r)))return;const a=async function(i,...l){const c=this.transaction(i,s?"readwrite":"readonly");let h=c.store;return n&&(h=h.index(l.shift())),(await Promise.all([h[r](...l),s&&c.done]))[0]};return S.set(e,a),a}Re(t=>({...t,get:(e,r,n)=>H(e,r)||t.get(e,r,n),has:(e,r)=>!!H(e,r)||t.has(e,r)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Le{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(r=>{if(He(r)){const n=r.getImmediate();return`${n.library}/${n.version}`}else return null}).filter(r=>r).join(" ")}}function He(t){const e=t.getComponent();return(e==null?void 0:e.type)==="VERSION"}const O="@firebase/app",x="0.14.7";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const d=new Ce("@firebase/app"),xe="@firebase/app-compat",ke="@firebase/analytics-compat",Ve="@firebase/analytics",ze="@firebase/app-check-compat",je="@firebase/app-check",We="@firebase/auth",Ge="@firebase/auth-compat",Ke="@firebase/database",Je="@firebase/data-connect",Ye="@firebase/database-compat",Xe="@firebase/functions",qe="@firebase/functions-compat",Ze="@firebase/installations",Qe="@firebase/installations-compat",et="@firebase/messaging",tt="@firebase/messaging-compat",rt="@firebase/performance",nt="@firebase/performance-compat",st="@firebase/remote-config",at="@firebase/remote-config-compat",it="@firebase/storage",ot="@firebase/storage-compat",ct="@firebase/firestore",lt="@firebase/ai",ht="@firebase/firestore-compat",dt="firebase";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ft="[DEFAULT]",ut={[O]:"fire-core",[xe]:"fire-core-compat",[Ve]:"fire-analytics",[ke]:"fire-analytics-compat",[je]:"fire-app-check",[ze]:"fire-app-check-compat",[We]:"fire-auth",[Ge]:"fire-auth-compat",[Ke]:"fire-rtdb",[Je]:"fire-data-connect",[Ye]:"fire-rtdb-compat",[Xe]:"fire-fn",[qe]:"fire-fn-compat",[Ze]:"fire-iid",[Qe]:"fire-iid-compat",[et]:"fire-fcm",[tt]:"fire-fcm-compat",[rt]:"fire-perf",[nt]:"fire-perf-compat",[st]:"fire-rc",[at]:"fire-rc-compat",[it]:"fire-gcs",[ot]:"fire-gcs-compat",[ct]:"fire-fst",[ht]:"fire-fst-compat",[lt]:"fire-vertex","fire-js":"fire-js",[dt]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const T=new Map,pt=new Map,M=new Map;function k(t,e){try{t.container.addComponent(e)}catch(r){d.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,r)}}function R(t){const e=t.name;if(M.has(e))return d.debug(`There were multiple attempts to register component ${e}.`),!1;M.set(e,t);for(const r of T.values())k(r,t);for(const r of pt.values())k(r,t);return!0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const gt={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},p=new J("app","Firebase",gt);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mt{constructor(e,r,n){this._isDeleted=!1,this._options={...e},this._config={...r},this._name=r.name,this._automaticDataCollectionEnabled=r.automaticDataCollectionEnabled,this._container=n,this.container.addComponent(new _("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw p.create("app-deleted",{appName:this._name})}}function bt(t,e={}){let r=t;typeof e!="object"&&(e={name:e});const n={name:ft,automaticDataCollectionEnabled:!0,...e},s=n.name;if(typeof s!="string"||!s)throw p.create("bad-app-name",{appName:String(s)});if(r||(r=de()),!r)throw p.create("no-options");const a=T.get(s);if(a){if(C(r,a.options)&&C(n,a.config))return a;throw p.create("duplicate-app",{appName:s})}const i=new _e(s);for(const c of M.values())i.addComponent(c);const l=new mt(r,n,i);return T.set(s,l),l}function E(t,e,r){let n=ut[t]??t;r&&(n+=`-${r}`);const s=n.match(/\s|\//),a=e.match(/\s|\//);if(s||a){const i=[`Unable to register library "${n}" with version "${e}":`];s&&i.push(`library name "${n}" contains illegal characters (whitespace or "/")`),s&&a&&i.push("and"),a&&i.push(`version name "${e}" contains illegal characters (whitespace or "/")`),d.warn(i.join(" "));return}R(new _(`${n}-version`,()=>({library:n,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt="firebase-heartbeat-database",wt=1,m="firebase-heartbeat-store";let A=null;function q(){return A||(A=Ne(yt,wt,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(m)}catch(r){console.warn(r)}}}}).catch(t=>{throw p.create("idb-open",{originalErrorMessage:t.message})})),A}async function Et(t){try{const r=(await q()).transaction(m),n=await r.objectStore(m).get(Z(t));return await r.done,n}catch(e){if(e instanceof b)d.warn(e.message);else{const r=p.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});d.warn(r.message)}}}async function V(t,e){try{const n=(await q()).transaction(m,"readwrite");await n.objectStore(m).put(e,Z(t)),await n.done}catch(r){if(r instanceof b)d.warn(r.message);else{const n=p.create("idb-set",{originalErrorMessage:r==null?void 0:r.message});d.warn(n.message)}}}function Z(t){return`${t.name}!${t.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _t=1024,Dt=30;class It{constructor(e){this.container=e,this._heartbeatsCache=null;const r=this.container.getProvider("app").getImmediate();this._storage=new At(r),this._heartbeatsCachePromise=this._storage.read().then(n=>(this._heartbeatsCache=n,n))}async triggerHeartbeat(){var e,r;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),a=z();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((r=this._heartbeatsCache)==null?void 0:r.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===a||this._heartbeatsCache.heartbeats.some(i=>i.date===a))return;if(this._heartbeatsCache.heartbeats.push({date:a,agent:s}),this._heartbeatsCache.heartbeats.length>Dt){const i=Ct(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(i,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(n){d.warn(n)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const r=z(),{heartbeatsToSend:n,unsentEntries:s}=St(this._heartbeatsCache.heartbeats),a=K(JSON.stringify({version:2,heartbeats:n}));return this._heartbeatsCache.lastSentHeartbeatDate=r,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),a}catch(r){return d.warn(r),""}}}function z(){return new Date().toISOString().substring(0,10)}function St(t,e=_t){const r=[];let n=t.slice();for(const s of t){const a=r.find(i=>i.agent===s.agent);if(a){if(a.dates.push(s.date),j(r)>e){a.dates.pop();break}}else if(r.push({agent:s.agent,dates:[s.date]}),j(r)>e){r.pop();break}n=n.slice(1)}return{heartbeatsToSend:r,unsentEntries:n}}class At{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return ue()?pe().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const r=await Et(this.app);return r!=null&&r.heartbeats?r:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const n=await this.read();return V(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const n=await this.read();return V(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??n.lastSentHeartbeatDate,heartbeats:[...n.heartbeats,...e.heartbeats]})}else return}}function j(t){return K(JSON.stringify({version:2,heartbeats:t})).length}function Ct(t){if(t.length===0)return-1;let e=0,r=t[0].date;for(let n=1;n<t.length;n++)t[n].date<r&&(r=t[n].date,e=n);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bt(t){R(new _("platform-logger",e=>new Le(e),"PRIVATE")),R(new _("heartbeat",e=>new It(e),"PRIVATE")),E(O,x,t),E(O,x,"esm2020"),E("fire-js","")}Bt("");var vt="firebase",Ot="12.8.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */E(vt,Ot,"app");const Q={apiKey:void 0,authDomain:void 0,projectId:void 0,storageBucket:void 0,messagingSenderId:void 0,appId:void 0};bt(Q);class Tt{constructor(){this.db=null,this.storage=null,this.auth=null,this.currentUser=null}async initialize(){return await new Promise(e=>{const r=setInterval(()=>{window.firebase&&(clearInterval(r),e())},100)}),window.firebase.apps.length||window.firebase.initializeApp(Q),this.auth=window.firebase.auth(),this.db=window.firebase.firestore(),this.storage=window.firebase.storage(),new Promise(e=>{this.auth.onAuthStateChanged(r=>{r?(this.currentUser=r,console.log("✓ Firebase: Authenticated user:",r.uid)):window.location.pathname!=="/login.html"&&window.location.pathname!=="/login"&&(window.location.href="/login.html"),e()})})}async saveBook(e){if(!this.currentUser)throw new Error("User not authenticated");const{data:r,...n}=e,s=this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(),a=`users/${this.currentUser.uid}/epubs/${s.id}.epub`;await this.storage.ref(a).put(r),console.log("✓ Firebase: EPUB uploaded to",a);const l={...n,id:s.id,storagePath:a,createdAt:window.firebase.firestore.FieldValue.serverTimestamp()};return await s.set(l),console.log("✓ Firebase: Book metadata saved to Firestore"),s.id}async getBook(e){if(!this.currentUser)throw new Error("User not authenticated");const r=await this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e).get();if(!r.exists)return null;const n=r.data();try{const s=await this.storage.ref(n.storagePath).getDownloadURL();n.downloadUrl=s}catch(s){console.error("Failed to get download URL",s),n.downloadUrl=null}return n}async getAllBooks(){if(!this.currentUser)throw new Error("User not authenticated");return(await this.db.collection("users").doc(this.currentUser.uid).collection("books").orderBy("createdAt","desc").get()).docs.map(r=>r.data())}async deleteBook(e){if(!this.currentUser)throw new Error("User not authenticated");const r=this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e),n=await r.get();if(n.exists&&n.data().storagePath)try{await this.storage.ref(n.data().storagePath).delete(),console.log("✓ Firebase: EPUB deleted from Storage")}catch(s){if(s.code!=="storage/object-not-found")throw console.error("Error deleting file from storage",s),s}await r.delete(),console.log("✓ Firebase: Book metadata deleted from Firestore"),await this.deleteAnalysis(e)}async updateBook(e,r){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e).update(r)}async saveSetting(e,r){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("settings").doc(e).set({value:r})}async getSetting(e){if(!this.currentUser)throw new Error("User not authenticated");const r=await this.db.collection("users").doc(this.currentUser.uid).collection("settings").doc(e).get();return r.exists?r.data().value:void 0}async getSettings(){return await this.getSetting("reader")||this._getDefaultSettings()}_getDefaultSettings(){return{theme:"light",fontFamily:"serif",fontSize:18,lineHeight:1.6,contentWidth:700,pageMusicSwitch:!1,crossfadeDuration:4}}async saveAnalysis(e,r){if(!this.currentUser)throw new Error("User not authenticated");const n={bookId:e,...r,analyzedAt:window.firebase.firestore.FieldValue.serverTimestamp()};await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).set(n)}async getAnalysis(e){if(!this.currentUser)throw new Error("User not authenticated");const r=await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).get();return r.exists?r.data():null}async deleteAnalysis(e){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).delete(),console.log("✓ Firebase: Analysis deleted for book",e)}}export{Tt as F};
