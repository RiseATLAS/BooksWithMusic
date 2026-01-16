(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function n(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(s){if(s.ep)return;s.ep=!0;const a=n(s);fetch(s.href,a)}})();const it=()=>{};var ae={};/**
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
 */const Se=function(t){const e=[];let n=0;for(let r=0;r<t.length;r++){let s=t.charCodeAt(r);s<128?e[n++]=s:s<2048?(e[n++]=s>>6|192,e[n++]=s&63|128):(s&64512)===55296&&r+1<t.length&&(t.charCodeAt(r+1)&64512)===56320?(s=65536+((s&1023)<<10)+(t.charCodeAt(++r)&1023),e[n++]=s>>18|240,e[n++]=s>>12&63|128,e[n++]=s>>6&63|128,e[n++]=s&63|128):(e[n++]=s>>12|224,e[n++]=s>>6&63|128,e[n++]=s&63|128)}return e},ot=function(t){const e=[];let n=0,r=0;for(;n<t.length;){const s=t[n++];if(s<128)e[r++]=String.fromCharCode(s);else if(s>191&&s<224){const a=t[n++];e[r++]=String.fromCharCode((s&31)<<6|a&63)}else if(s>239&&s<365){const a=t[n++],i=t[n++],o=t[n++],c=((s&7)<<18|(a&63)<<12|(i&63)<<6|o&63)-65536;e[r++]=String.fromCharCode(55296+(c>>10)),e[r++]=String.fromCharCode(56320+(c&1023))}else{const a=t[n++],i=t[n++];e[r++]=String.fromCharCode((s&15)<<12|(a&63)<<6|i&63)}}return e.join("")},Te={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(t,e){if(!Array.isArray(t))throw Error("encodeByteArray takes an array as a parameter");this.init_();const n=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let s=0;s<t.length;s+=3){const a=t[s],i=s+1<t.length,o=i?t[s+1]:0,c=s+2<t.length,l=c?t[s+2]:0,f=a>>2,u=(a&3)<<4|o>>4;let p=(o&15)<<2|l>>6,R=l&63;c||(R=64,i||(p=64)),r.push(n[f],n[u],n[p],n[R])}return r.join("")},encodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(t):this.encodeByteArray(Se(t),e)},decodeString(t,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(t):ot(this.decodeStringToByteArray(t,e))},decodeStringToByteArray(t,e){this.init_();const n=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let s=0;s<t.length;){const a=n[t.charAt(s++)],o=s<t.length?n[t.charAt(s)]:0;++s;const l=s<t.length?n[t.charAt(s)]:64;++s;const u=s<t.length?n[t.charAt(s)]:64;if(++s,a==null||o==null||l==null||u==null)throw new ct;const p=a<<2|o>>4;if(r.push(p),l!==64){const R=o<<4&240|l>>2;if(r.push(R),u!==64){const at=l<<6&192|u;r.push(at)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let t=0;t<this.ENCODED_VALS.length;t++)this.byteToCharMap_[t]=this.ENCODED_VALS.charAt(t),this.charToByteMap_[this.byteToCharMap_[t]]=t,this.byteToCharMapWebSafe_[t]=this.ENCODED_VALS_WEBSAFE.charAt(t),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[t]]=t,t>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(t)]=t,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(t)]=t)}}};class ct extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const lt=function(t){const e=Se(t);return Te.encodeByteArray(e,!0)},De=function(t){return lt(t).replace(/\./g,"")},dt=function(t){try{return Te.decodeString(t,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
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
 */function ut(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
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
 */const ht=()=>ut().__FIREBASE_DEFAULTS__,ft=()=>{if(typeof process>"u"||typeof ae>"u")return;const t=ae.__FIREBASE_DEFAULTS__;if(t)return JSON.parse(t)},pt=()=>{if(typeof document>"u")return;let t;try{t=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=t&&dt(t[1]);return e&&JSON.parse(e)},gt=()=>{try{return it()||ht()||ft()||pt()}catch(t){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${t}`);return}},ve=()=>{var t;return(t=gt())==null?void 0:t.config};/**
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
 */class mt{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,n)=>{this.resolve=e,this.reject=n})}wrapCallback(e){return(n,r)=>{n?this.reject(n):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(n):e(n,r))}}}function bt(){const t=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof t=="object"&&t.id!==void 0}function Ce(){try{return typeof indexedDB=="object"}catch{return!1}}function Re(){return new Promise((t,e)=>{try{let n=!0;const r="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(r);s.onsuccess=()=>{s.result.close(),n||self.indexedDB.deleteDatabase(r),t(!0)},s.onupgradeneeded=()=>{n=!1},s.onerror=()=>{var a;e(((a=s.error)==null?void 0:a.message)||"")}}catch(n){e(n)}})}function wt(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
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
 */const yt="FirebaseError";class D extends Error{constructor(e,n,r){super(n),this.code=e,this.customData=r,this.name=yt,Object.setPrototypeOf(this,D.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,$.prototype.create)}}class ${constructor(e,n,r){this.service=e,this.serviceName=n,this.errors=r}create(e,...n){const r=n[0]||{},s=`${this.service}/${e}`,a=this.errors[e],i=a?It(a,r):"Error",o=`${this.serviceName}: ${i} (${s}).`;return new D(s,o,r)}}function It(t,e){return t.replace(Et,(n,r)=>{const s=e[r];return s!=null?String(s):`<${r}?>`})}const Et=/\{\$([^}]+)}/g;function B(t,e){if(t===e)return!0;const n=Object.keys(t),r=Object.keys(e);for(const s of n){if(!r.includes(s))return!1;const a=t[s],i=e[s];if(ie(a)&&ie(i)){if(!B(a,i))return!1}else if(a!==i)return!1}for(const s of r)if(!n.includes(s))return!1;return!0}function ie(t){return t!==null&&typeof t=="object"}/**
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
 */const At=1e3,_t=2,St=4*60*60*1e3,Tt=.5;function oe(t,e=At,n=_t){const r=e*Math.pow(n,t),s=Math.round(Tt*r*(Math.random()-.5)*2);return Math.min(St,r+s)}/**
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
 */function X(t){return t&&t._delegate?t._delegate:t}class I{constructor(e,n,r){this.name=e,this.instanceFactory=n,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
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
 */const E="[DEFAULT]";/**
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
 */class Dt{constructor(e,n){this.name=e,this.container=n,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const n=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(n)){const r=new mt;if(this.instancesDeferred.set(n,r),this.isInitialized(n)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:n});s&&r.resolve(s)}catch{}}return this.instancesDeferred.get(n).promise}getImmediate(e){const n=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(n)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:n})}catch(s){if(r)return null;throw s}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(Ct(e))try{this.getOrInitializeService({instanceIdentifier:E})}catch{}for(const[n,r]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(n);try{const a=this.getOrInitializeService({instanceIdentifier:s});r.resolve(a)}catch{}}}}clearInstance(e=E){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(n=>"INTERNAL"in n).map(n=>n.INTERNAL.delete()),...e.filter(n=>"_delete"in n).map(n=>n._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=E){return this.instances.has(e)}getOptions(e=E){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:n={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:r,options:n});for(const[a,i]of this.instancesDeferred.entries()){const o=this.normalizeInstanceIdentifier(a);r===o&&i.resolve(s)}return s}onInit(e,n){const r=this.normalizeInstanceIdentifier(n),s=this.onInitCallbacks.get(r)??new Set;s.add(e),this.onInitCallbacks.set(r,s);const a=this.instances.get(r);return a&&e(a,r),()=>{s.delete(e)}}invokeOnInitCallbacks(e,n){const r=this.onInitCallbacks.get(n);if(r)for(const s of r)try{s(e,n)}catch{}}getOrInitializeService({instanceIdentifier:e,options:n={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:vt(e),options:n}),this.instances.set(e,r),this.instancesOptions.set(e,n),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=E){return this.component?this.component.multipleInstances?e:E:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function vt(t){return t===E?void 0:t}function Ct(t){return t.instantiationMode==="EAGER"}/**
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
 */class Rt{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const n=this.getProvider(e.name);if(n.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);n.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const n=new Dt(e,this);return this.providers.set(e,n),n}getProviders(){return Array.from(this.providers.values())}}/**
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
 */var d;(function(t){t[t.DEBUG=0]="DEBUG",t[t.VERBOSE=1]="VERBOSE",t[t.INFO=2]="INFO",t[t.WARN=3]="WARN",t[t.ERROR=4]="ERROR",t[t.SILENT=5]="SILENT"})(d||(d={}));const Bt={debug:d.DEBUG,verbose:d.VERBOSE,info:d.INFO,warn:d.WARN,error:d.ERROR,silent:d.SILENT},Mt=d.INFO,Ot={[d.DEBUG]:"log",[d.VERBOSE]:"log",[d.INFO]:"info",[d.WARN]:"warn",[d.ERROR]:"error"},Pt=(t,e,...n)=>{if(e<t.logLevel)return;const r=new Date().toISOString(),s=Ot[e];if(s)console[s](`[${r}]  ${t.name}:`,...n);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class Be{constructor(e){this.name=e,this._logLevel=Mt,this._logHandler=Pt,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in d))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?Bt[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,d.DEBUG,...e),this._logHandler(this,d.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,d.VERBOSE,...e),this._logHandler(this,d.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,d.INFO,...e),this._logHandler(this,d.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,d.WARN,...e),this._logHandler(this,d.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,d.ERROR,...e),this._logHandler(this,d.ERROR,...e)}}const $t=(t,e)=>e.some(n=>t instanceof n);let ce,le;function kt(){return ce||(ce=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Ft(){return le||(le=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Me=new WeakMap,W=new WeakMap,Oe=new WeakMap,L=new WeakMap,Z=new WeakMap;function Nt(t){const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("success",a),t.removeEventListener("error",i)},a=()=>{n(b(t.result)),s()},i=()=>{r(t.error),s()};t.addEventListener("success",a),t.addEventListener("error",i)});return e.then(n=>{n instanceof IDBCursor&&Me.set(n,t)}).catch(()=>{}),Z.set(e,t),e}function Lt(t){if(W.has(t))return;const e=new Promise((n,r)=>{const s=()=>{t.removeEventListener("complete",a),t.removeEventListener("error",i),t.removeEventListener("abort",i)},a=()=>{n(),s()},i=()=>{r(t.error||new DOMException("AbortError","AbortError")),s()};t.addEventListener("complete",a),t.addEventListener("error",i),t.addEventListener("abort",i)});W.set(t,e)}let q={get(t,e,n){if(t instanceof IDBTransaction){if(e==="done")return W.get(t);if(e==="objectStoreNames")return t.objectStoreNames||Oe.get(t);if(e==="store")return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return b(t[e])},set(t,e,n){return t[e]=n,!0},has(t,e){return t instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in t}};function Ut(t){q=t(q)}function xt(t){return t===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...n){const r=t.call(U(this),e,...n);return Oe.set(r,e.sort?e.sort():[e]),b(r)}:Ft().includes(t)?function(...e){return t.apply(U(this),e),b(Me.get(this))}:function(...e){return b(t.apply(U(this),e))}}function Ht(t){return typeof t=="function"?xt(t):(t instanceof IDBTransaction&&Lt(t),$t(t,kt())?new Proxy(t,q):t)}function b(t){if(t instanceof IDBRequest)return Nt(t);if(L.has(t))return L.get(t);const e=Ht(t);return e!==t&&(L.set(t,e),Z.set(e,t)),e}const U=t=>Z.get(t);function Pe(t,e,{blocked:n,upgrade:r,blocking:s,terminated:a}={}){const i=indexedDB.open(t,e),o=b(i);return r&&i.addEventListener("upgradeneeded",c=>{r(b(i.result),c.oldVersion,c.newVersion,b(i.transaction),c)}),n&&i.addEventListener("blocked",c=>n(c.oldVersion,c.newVersion,c)),o.then(c=>{a&&c.addEventListener("close",()=>a()),s&&c.addEventListener("versionchange",l=>s(l.oldVersion,l.newVersion,l))}).catch(()=>{}),o}const Vt=["get","getKey","getAll","getAllKeys","count"],jt=["put","add","delete","clear"],x=new Map;function de(t,e){if(!(t instanceof IDBDatabase&&!(e in t)&&typeof e=="string"))return;if(x.get(e))return x.get(e);const n=e.replace(/FromIndex$/,""),r=e!==n,s=jt.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(s||Vt.includes(n)))return;const a=async function(i,...o){const c=this.transaction(i,s?"readwrite":"readonly");let l=c.store;return r&&(l=l.index(o.shift())),(await Promise.all([l[n](...o),s&&c.done]))[0]};return x.set(e,a),a}Ut(t=>({...t,get:(e,n,r)=>de(e,n)||t.get(e,n,r),has:(e,n)=>!!de(e,n)||t.has(e,n)}));/**
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
 */class zt{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(n=>{if(Wt(n)){const r=n.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(n=>n).join(" ")}}function Wt(t){const e=t.getComponent();return(e==null?void 0:e.type)==="VERSION"}const G="@firebase/app",ue="0.14.7";/**
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
 */const m=new Be("@firebase/app"),qt="@firebase/app-compat",Gt="@firebase/analytics-compat",Kt="@firebase/analytics",Yt="@firebase/app-check-compat",Jt="@firebase/app-check",Xt="@firebase/auth",Zt="@firebase/auth-compat",Qt="@firebase/database",en="@firebase/data-connect",tn="@firebase/database-compat",nn="@firebase/functions",rn="@firebase/functions-compat",sn="@firebase/installations",an="@firebase/installations-compat",on="@firebase/messaging",cn="@firebase/messaging-compat",ln="@firebase/performance",dn="@firebase/performance-compat",un="@firebase/remote-config",hn="@firebase/remote-config-compat",fn="@firebase/storage",pn="@firebase/storage-compat",gn="@firebase/firestore",mn="@firebase/ai",bn="@firebase/firestore-compat",wn="firebase";/**
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
 */const K="[DEFAULT]",yn={[G]:"fire-core",[qt]:"fire-core-compat",[Kt]:"fire-analytics",[Gt]:"fire-analytics-compat",[Jt]:"fire-app-check",[Yt]:"fire-app-check-compat",[Xt]:"fire-auth",[Zt]:"fire-auth-compat",[Qt]:"fire-rtdb",[en]:"fire-data-connect",[tn]:"fire-rtdb-compat",[nn]:"fire-fn",[rn]:"fire-fn-compat",[sn]:"fire-iid",[an]:"fire-iid-compat",[on]:"fire-fcm",[cn]:"fire-fcm-compat",[ln]:"fire-perf",[dn]:"fire-perf-compat",[un]:"fire-rc",[hn]:"fire-rc-compat",[fn]:"fire-gcs",[pn]:"fire-gcs-compat",[gn]:"fire-fst",[bn]:"fire-fst-compat",[mn]:"fire-vertex","fire-js":"fire-js",[wn]:"fire-js-all"};/**
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
 */const M=new Map,In=new Map,Y=new Map;function he(t,e){try{t.container.addComponent(e)}catch(n){m.debug(`Component ${e.name} failed to register with FirebaseApp ${t.name}`,n)}}function _(t){const e=t.name;if(Y.has(e))return m.debug(`There were multiple attempts to register component ${e}.`),!1;Y.set(e,t);for(const n of M.values())he(n,t);for(const n of In.values())he(n,t);return!0}function k(t,e){const n=t.container.getProvider("heartbeat").getImmediate({optional:!0});return n&&n.triggerHeartbeat(),t.container.getProvider(e)}/**
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
 */const En={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},w=new $("app","Firebase",En);/**
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
 */class An{constructor(e,n,r){this._isDeleted=!1,this._options={...e},this._config={...n},this._name=n.name,this._automaticDataCollectionEnabled=n.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new I("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw w.create("app-deleted",{appName:this._name})}}function $e(t,e={}){let n=t;typeof e!="object"&&(e={name:e});const r={name:K,automaticDataCollectionEnabled:!0,...e},s=r.name;if(typeof s!="string"||!s)throw w.create("bad-app-name",{appName:String(s)});if(n||(n=ve()),!n)throw w.create("no-options");const a=M.get(s);if(a){if(B(n,a.options)&&B(r,a.config))return a;throw w.create("duplicate-app",{appName:s})}const i=new Rt(s);for(const c of Y.values())i.addComponent(c);const o=new An(n,r,i);return M.set(s,o),o}function _n(t=K){const e=M.get(t);if(!e&&t===K&&ve())return $e();if(!e)throw w.create("no-app",{appName:t});return e}function y(t,e,n){let r=yn[t]??t;n&&(r+=`-${n}`);const s=r.match(/\s|\//),a=e.match(/\s|\//);if(s||a){const i=[`Unable to register library "${r}" with version "${e}":`];s&&i.push(`library name "${r}" contains illegal characters (whitespace or "/")`),s&&a&&i.push("and"),a&&i.push(`version name "${e}" contains illegal characters (whitespace or "/")`),m.warn(i.join(" "));return}_(new I(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
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
 */const Sn="firebase-heartbeat-database",Tn=1,C="firebase-heartbeat-store";let H=null;function ke(){return H||(H=Pe(Sn,Tn,{upgrade:(t,e)=>{switch(e){case 0:try{t.createObjectStore(C)}catch(n){console.warn(n)}}}}).catch(t=>{throw w.create("idb-open",{originalErrorMessage:t.message})})),H}async function Dn(t){try{const n=(await ke()).transaction(C),r=await n.objectStore(C).get(Fe(t));return await n.done,r}catch(e){if(e instanceof D)m.warn(e.message);else{const n=w.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});m.warn(n.message)}}}async function fe(t,e){try{const r=(await ke()).transaction(C,"readwrite");await r.objectStore(C).put(e,Fe(t)),await r.done}catch(n){if(n instanceof D)m.warn(n.message);else{const r=w.create("idb-set",{originalErrorMessage:n==null?void 0:n.message});m.warn(r.message)}}}function Fe(t){return`${t.name}!${t.options.appId}`}/**
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
 */const vn=1024,Cn=30;class Rn{constructor(e){this.container=e,this._heartbeatsCache=null;const n=this.container.getProvider("app").getImmediate();this._storage=new Mn(n),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,n;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),a=pe();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((n=this._heartbeatsCache)==null?void 0:n.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===a||this._heartbeatsCache.heartbeats.some(i=>i.date===a))return;if(this._heartbeatsCache.heartbeats.push({date:a,agent:s}),this._heartbeatsCache.heartbeats.length>Cn){const i=On(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(i,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){m.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const n=pe(),{heartbeatsToSend:r,unsentEntries:s}=Bn(this._heartbeatsCache.heartbeats),a=De(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=n,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),a}catch(n){return m.warn(n),""}}}function pe(){return new Date().toISOString().substring(0,10)}function Bn(t,e=vn){const n=[];let r=t.slice();for(const s of t){const a=n.find(i=>i.agent===s.agent);if(a){if(a.dates.push(s.date),ge(n)>e){a.dates.pop();break}}else if(n.push({agent:s.agent,dates:[s.date]}),ge(n)>e){n.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}class Mn{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ce()?Re().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const n=await Dn(this.app);return n!=null&&n.heartbeats?n:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return fe(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return fe(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function ge(t){return De(JSON.stringify({version:2,heartbeats:t})).length}function On(t){if(t.length===0)return-1;let e=0,n=t[0].date;for(let r=1;r<t.length;r++)t[r].date<n&&(n=t[r].date,e=r);return e}/**
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
 */function Pn(t){_(new I("platform-logger",e=>new zt(e),"PRIVATE")),_(new I("heartbeat",e=>new Rn(e),"PRIVATE")),y(G,ue,t),y(G,ue,"esm2020"),y("fire-js","")}Pn("");var $n="firebase",kn="12.8.0";/**
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
 */y($n,kn,"app");const Ne="@firebase/installations",Q="0.6.19";/**
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
 */const Le=1e4,Ue=`w:${Q}`,xe="FIS_v2",Fn="https://firebaseinstallations.googleapis.com/v1",Nn=60*60*1e3,Ln="installations",Un="Installations";/**
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
 */const xn={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},S=new $(Ln,Un,xn);function He(t){return t instanceof D&&t.code.includes("request-failed")}/**
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
 */function Ve({projectId:t}){return`${Fn}/projects/${t}/installations`}function je(t){return{token:t.token,requestStatus:2,expiresIn:Vn(t.expiresIn),creationTime:Date.now()}}async function ze(t,e){const r=(await e.json()).error;return S.create("request-failed",{requestName:t,serverCode:r.code,serverMessage:r.message,serverStatus:r.status})}function We({apiKey:t}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":t})}function Hn(t,{refreshToken:e}){const n=We(t);return n.append("Authorization",jn(e)),n}async function qe(t){const e=await t();return e.status>=500&&e.status<600?t():e}function Vn(t){return Number(t.replace("s","000"))}function jn(t){return`${xe} ${t}`}/**
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
 */async function zn({appConfig:t,heartbeatServiceProvider:e},{fid:n}){const r=Ve(t),s=We(t),a=e.getImmediate({optional:!0});if(a){const l=await a.getHeartbeatsHeader();l&&s.append("x-firebase-client",l)}const i={fid:n,authVersion:xe,appId:t.appId,sdkVersion:Ue},o={method:"POST",headers:s,body:JSON.stringify(i)},c=await qe(()=>fetch(r,o));if(c.ok){const l=await c.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:je(l.authToken)}}else throw await ze("Create Installation",c)}/**
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
 */function Ge(t){return new Promise(e=>{setTimeout(e,t)})}/**
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
 */function Wn(t){return btoa(String.fromCharCode(...t)).replace(/\+/g,"-").replace(/\//g,"_")}/**
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
 */const qn=/^[cdef][\w-]{21}$/,J="";function Gn(){try{const t=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(t),t[0]=112+t[0]%16;const n=Kn(t);return qn.test(n)?n:J}catch{return J}}function Kn(t){return Wn(t).substr(0,22)}/**
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
 */function F(t){return`${t.appName}!${t.appId}`}/**
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
 */const Ke=new Map;function Ye(t,e){const n=F(t);Je(n,e),Yn(n,e)}function Je(t,e){const n=Ke.get(t);if(n)for(const r of n)r(e)}function Yn(t,e){const n=Jn();n&&n.postMessage({key:t,fid:e}),Xn()}let A=null;function Jn(){return!A&&"BroadcastChannel"in self&&(A=new BroadcastChannel("[Firebase] FID Change"),A.onmessage=t=>{Je(t.data.key,t.data.fid)}),A}function Xn(){Ke.size===0&&A&&(A.close(),A=null)}/**
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
 */const Zn="firebase-installations-database",Qn=1,T="firebase-installations-store";let V=null;function ee(){return V||(V=Pe(Zn,Qn,{upgrade:(t,e)=>{switch(e){case 0:t.createObjectStore(T)}}})),V}async function O(t,e){const n=F(t),s=(await ee()).transaction(T,"readwrite"),a=s.objectStore(T),i=await a.get(n);return await a.put(e,n),await s.done,(!i||i.fid!==e.fid)&&Ye(t,e.fid),e}async function Xe(t){const e=F(t),r=(await ee()).transaction(T,"readwrite");await r.objectStore(T).delete(e),await r.done}async function N(t,e){const n=F(t),s=(await ee()).transaction(T,"readwrite"),a=s.objectStore(T),i=await a.get(n),o=e(i);return o===void 0?await a.delete(n):await a.put(o,n),await s.done,o&&(!i||i.fid!==o.fid)&&Ye(t,o.fid),o}/**
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
 */async function te(t){let e;const n=await N(t.appConfig,r=>{const s=er(r),a=tr(t,s);return e=a.registrationPromise,a.installationEntry});return n.fid===J?{installationEntry:await e}:{installationEntry:n,registrationPromise:e}}function er(t){const e=t||{fid:Gn(),registrationStatus:0};return Ze(e)}function tr(t,e){if(e.registrationStatus===0){if(!navigator.onLine){const s=Promise.reject(S.create("app-offline"));return{installationEntry:e,registrationPromise:s}}const n={fid:e.fid,registrationStatus:1,registrationTime:Date.now()},r=nr(t,n);return{installationEntry:n,registrationPromise:r}}else return e.registrationStatus===1?{installationEntry:e,registrationPromise:rr(t)}:{installationEntry:e}}async function nr(t,e){try{const n=await zn(t,e);return O(t.appConfig,n)}catch(n){throw He(n)&&n.customData.serverCode===409?await Xe(t.appConfig):await O(t.appConfig,{fid:e.fid,registrationStatus:0}),n}}async function rr(t){let e=await me(t.appConfig);for(;e.registrationStatus===1;)await Ge(100),e=await me(t.appConfig);if(e.registrationStatus===0){const{installationEntry:n,registrationPromise:r}=await te(t);return r||n}return e}function me(t){return N(t,e=>{if(!e)throw S.create("installation-not-found");return Ze(e)})}function Ze(t){return sr(t)?{fid:t.fid,registrationStatus:0}:t}function sr(t){return t.registrationStatus===1&&t.registrationTime+Le<Date.now()}/**
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
 */async function ar({appConfig:t,heartbeatServiceProvider:e},n){const r=ir(t,n),s=Hn(t,n),a=e.getImmediate({optional:!0});if(a){const l=await a.getHeartbeatsHeader();l&&s.append("x-firebase-client",l)}const i={installation:{sdkVersion:Ue,appId:t.appId}},o={method:"POST",headers:s,body:JSON.stringify(i)},c=await qe(()=>fetch(r,o));if(c.ok){const l=await c.json();return je(l)}else throw await ze("Generate Auth Token",c)}function ir(t,{fid:e}){return`${Ve(t)}/${e}/authTokens:generate`}/**
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
 */async function ne(t,e=!1){let n;const r=await N(t.appConfig,a=>{if(!Qe(a))throw S.create("not-registered");const i=a.authToken;if(!e&&lr(i))return a;if(i.requestStatus===1)return n=or(t,e),a;{if(!navigator.onLine)throw S.create("app-offline");const o=ur(a);return n=cr(t,o),o}});return n?await n:r.authToken}async function or(t,e){let n=await be(t.appConfig);for(;n.authToken.requestStatus===1;)await Ge(100),n=await be(t.appConfig);const r=n.authToken;return r.requestStatus===0?ne(t,e):r}function be(t){return N(t,e=>{if(!Qe(e))throw S.create("not-registered");const n=e.authToken;return hr(n)?{...e,authToken:{requestStatus:0}}:e})}async function cr(t,e){try{const n=await ar(t,e),r={...e,authToken:n};return await O(t.appConfig,r),n}catch(n){if(He(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await Xe(t.appConfig);else{const r={...e,authToken:{requestStatus:0}};await O(t.appConfig,r)}throw n}}function Qe(t){return t!==void 0&&t.registrationStatus===2}function lr(t){return t.requestStatus===2&&!dr(t)}function dr(t){const e=Date.now();return e<t.creationTime||t.creationTime+t.expiresIn<e+Nn}function ur(t){const e={requestStatus:1,requestTime:Date.now()};return{...t,authToken:e}}function hr(t){return t.requestStatus===1&&t.requestTime+Le<Date.now()}/**
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
 */async function fr(t){const e=t,{installationEntry:n,registrationPromise:r}=await te(e);return r?r.catch(console.error):ne(e).catch(console.error),n.fid}/**
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
 */async function pr(t,e=!1){const n=t;return await gr(n),(await ne(n,e)).token}async function gr(t){const{registrationPromise:e}=await te(t);e&&await e}/**
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
 */function mr(t){if(!t||!t.options)throw j("App Configuration");if(!t.name)throw j("App Name");const e=["projectId","apiKey","appId"];for(const n of e)if(!t.options[n])throw j(n);return{appName:t.name,projectId:t.options.projectId,apiKey:t.options.apiKey,appId:t.options.appId}}function j(t){return S.create("missing-app-config-values",{valueName:t})}/**
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
 */const et="installations",br="installations-internal",wr=t=>{const e=t.getProvider("app").getImmediate(),n=mr(e),r=k(e,"heartbeat");return{app:e,appConfig:n,heartbeatServiceProvider:r,_delete:()=>Promise.resolve()}},yr=t=>{const e=t.getProvider("app").getImmediate(),n=k(e,et).getImmediate();return{getId:()=>fr(n),getToken:s=>pr(n,s)}};function Ir(){_(new I(et,wr,"PUBLIC")),_(new I(br,yr,"PRIVATE"))}Ir();y(Ne,Q);y(Ne,Q,"esm2020");/**
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
 */const P="analytics",Er="firebase_id",Ar="origin",_r=60*1e3,Sr="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",re="https://www.googletagmanager.com/gtag/js";/**
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
 */const h=new Be("@firebase/analytics");/**
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
 */const Tr={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},g=new $("analytics","Analytics",Tr);/**
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
 */function Dr(t){if(!t.startsWith(re)){const e=g.create("invalid-gtag-resource",{gtagURL:t});return h.warn(e.message),""}return t}function tt(t){return Promise.all(t.map(e=>e.catch(n=>n)))}function vr(t,e){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(t,e)),n}function Cr(t,e){const n=vr("firebase-js-sdk-policy",{createScriptURL:Dr}),r=document.createElement("script"),s=`${re}?l=${t}&id=${e}`;r.src=n?n==null?void 0:n.createScriptURL(s):s,r.async=!0,document.head.appendChild(r)}function Rr(t){let e=[];return Array.isArray(window[t])?e=window[t]:window[t]=e,e}async function Br(t,e,n,r,s,a){const i=r[s];try{if(i)await e[i];else{const c=(await tt(n)).find(l=>l.measurementId===s);c&&await e[c.appId]}}catch(o){h.error(o)}t("config",s,a)}async function Mr(t,e,n,r,s){try{let a=[];if(s&&s.send_to){let i=s.send_to;Array.isArray(i)||(i=[i]);const o=await tt(n);for(const c of i){const l=o.find(u=>u.measurementId===c),f=l&&e[l.appId];if(f)a.push(f);else{a=[];break}}}a.length===0&&(a=Object.values(e)),await Promise.all(a),t("event",r,s||{})}catch(a){h.error(a)}}function Or(t,e,n,r){async function s(a,...i){try{if(a==="event"){const[o,c]=i;await Mr(t,e,n,o,c)}else if(a==="config"){const[o,c]=i;await Br(t,e,n,r,o,c)}else if(a==="consent"){const[o,c]=i;t("consent",o,c)}else if(a==="get"){const[o,c,l]=i;t("get",o,c,l)}else if(a==="set"){const[o]=i;t("set",o)}else t(a,...i)}catch(o){h.error(o)}}return s}function Pr(t,e,n,r,s){let a=function(...i){window[r].push(arguments)};return window[s]&&typeof window[s]=="function"&&(a=window[s]),window[s]=Or(a,t,e,n),{gtagCore:a,wrappedGtag:window[s]}}function $r(t){const e=window.document.getElementsByTagName("script");for(const n of Object.values(e))if(n.src&&n.src.includes(re)&&n.src.includes(t))return n;return null}/**
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
 */const kr=30,Fr=1e3;class Nr{constructor(e={},n=Fr){this.throttleMetadata=e,this.intervalMillis=n}getThrottleMetadata(e){return this.throttleMetadata[e]}setThrottleMetadata(e,n){this.throttleMetadata[e]=n}deleteThrottleMetadata(e){delete this.throttleMetadata[e]}}const nt=new Nr;function Lr(t){return new Headers({Accept:"application/json","x-goog-api-key":t})}async function Ur(t){var i;const{appId:e,apiKey:n}=t,r={method:"GET",headers:Lr(n)},s=Sr.replace("{app-id}",e),a=await fetch(s,r);if(a.status!==200&&a.status!==304){let o="";try{const c=await a.json();(i=c.error)!=null&&i.message&&(o=c.error.message)}catch{}throw g.create("config-fetch-failed",{httpStatus:a.status,responseMessage:o})}return a.json()}async function xr(t,e=nt,n){const{appId:r,apiKey:s,measurementId:a}=t.options;if(!r)throw g.create("no-app-id");if(!s){if(a)return{measurementId:a,appId:r};throw g.create("no-api-key")}const i=e.getThrottleMetadata(r)||{backoffCount:0,throttleEndTimeMillis:Date.now()},o=new jr;return setTimeout(async()=>{o.abort()},_r),rt({appId:r,apiKey:s,measurementId:a},i,o,e)}async function rt(t,{throttleEndTimeMillis:e,backoffCount:n},r,s=nt){var o;const{appId:a,measurementId:i}=t;try{await Hr(r,e)}catch(c){if(i)return h.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${i} provided in the "measurementId" field in the local Firebase config. [${c==null?void 0:c.message}]`),{appId:a,measurementId:i};throw c}try{const c=await Ur(t);return s.deleteThrottleMetadata(a),c}catch(c){const l=c;if(!Vr(l)){if(s.deleteThrottleMetadata(a),i)return h.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${i} provided in the "measurementId" field in the local Firebase config. [${l==null?void 0:l.message}]`),{appId:a,measurementId:i};throw c}const f=Number((o=l==null?void 0:l.customData)==null?void 0:o.httpStatus)===503?oe(n,s.intervalMillis,kr):oe(n,s.intervalMillis),u={throttleEndTimeMillis:Date.now()+f,backoffCount:n+1};return s.setThrottleMetadata(a,u),h.debug(`Calling attemptFetch again in ${f} millis`),rt(t,u,r,s)}}function Hr(t,e){return new Promise((n,r)=>{const s=Math.max(e-Date.now(),0),a=setTimeout(n,s);t.addEventListener(()=>{clearTimeout(a),r(g.create("fetch-throttle",{throttleEndTimeMillis:e}))})})}function Vr(t){if(!(t instanceof D)||!t.customData)return!1;const e=Number(t.customData.httpStatus);return e===429||e===500||e===503||e===504}class jr{constructor(){this.listeners=[]}addEventListener(e){this.listeners.push(e)}abort(){this.listeners.forEach(e=>e())}}async function zr(t,e,n,r,s){if(s&&s.global){t("event",n,r);return}else{const a=await e,i={...r,send_to:a};t("event",n,i)}}async function Wr(t,e,n,r){if(r&&r.global){const s={};for(const a of Object.keys(n))s[`user_properties.${a}`]=n[a];return t("set",s),Promise.resolve()}else{const s=await e;t("config",s,{update:!0,user_properties:n})}}/**
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
 */async function qr(){if(Ce())try{await Re()}catch(t){return h.warn(g.create("indexeddb-unavailable",{errorInfo:t==null?void 0:t.toString()}).message),!1}else return h.warn(g.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function Gr(t,e,n,r,s,a,i){const o=xr(t);o.then(p=>{n[p.measurementId]=p.appId,t.options.measurementId&&p.measurementId!==t.options.measurementId&&h.warn(`The measurement ID in the local Firebase config (${t.options.measurementId}) does not match the measurement ID fetched from the server (${p.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(p=>h.error(p)),e.push(o);const c=qr().then(p=>{if(p)return r.getId()}),[l,f]=await Promise.all([o,c]);$r(a)||Cr(a,l.measurementId),s("js",new Date);const u=(i==null?void 0:i.config)??{};return u[Ar]="firebase",u.update=!0,f!=null&&(u[Er]=f),s("config",l.measurementId,u),l.measurementId}/**
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
 */class Kr{constructor(e){this.app=e}_delete(){return delete v[this.app.options.appId],Promise.resolve()}}let v={},we=[];const ye={};let z="dataLayer",Yr="gtag",Ie,se,Ee=!1;function Jr(){const t=[];if(bt()&&t.push("This is a browser extension environment."),wt()||t.push("Cookies are not available."),t.length>0){const e=t.map((r,s)=>`(${s+1}) ${r}`).join(" "),n=g.create("invalid-analytics-context",{errorInfo:e});h.warn(n.message)}}function Xr(t,e,n){Jr();const r=t.options.appId;if(!r)throw g.create("no-app-id");if(!t.options.apiKey)if(t.options.measurementId)h.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${t.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw g.create("no-api-key");if(v[r]!=null)throw g.create("already-exists",{id:r});if(!Ee){Rr(z);const{wrappedGtag:a,gtagCore:i}=Pr(v,we,ye,z,Yr);se=a,Ie=i,Ee=!0}return v[r]=Gr(t,we,ye,e,Ie,z,n),new Kr(t)}function Zr(t=_n()){t=X(t);const e=k(t,P);return e.isInitialized()?e.getImmediate():Qr(t)}function Qr(t,e={}){const n=k(t,P);if(n.isInitialized()){const s=n.getImmediate();if(B(e,n.getOptions()))return s;throw g.create("already-initialized")}return n.initialize({options:e})}function es(t,e,n){t=X(t),Wr(se,v[t.app.options.appId],e,n).catch(r=>h.error(r))}function ts(t,e,n,r){t=X(t),zr(se,v[t.app.options.appId],e,n,r).catch(s=>h.error(s))}const Ae="@firebase/analytics",_e="0.10.19";function ns(){_(new I(P,(e,{options:n})=>{const r=e.getProvider("app").getImmediate(),s=e.getProvider("installations-internal").getImmediate();return Xr(r,s,n)},"PUBLIC")),_(new I("analytics-internal",t,"PRIVATE")),y(Ae,_e),y(Ae,_e,"esm2020");function t(e){try{const n=e.getProvider(P).getImmediate();return{logEvent:(r,s,a)=>ts(n,r,s,a),setUserProperties:(r,s)=>es(n,r,s)}}catch(n){throw g.create("interop-component-reg-failed",{reason:n})}}}ns();const st={apiKey:"AIzaSyC897FLQZPGYhZ5Y40VxVFnM2O3dGcRAqA",authDomain:"bookswithmusic-85876084-f64fa.firebaseapp.com",projectId:"bookswithmusic-85876084-f64fa",storageBucket:"bookswithmusic-85876084-f64fa.firebasestorage.app",messagingSenderId:"902115268020",appId:"1:902115268020:web:bb2b3b75f6703cdd018ee1",measurementId:"YOUR_MEASUREMENT_ID"},rs=$e(st);Zr(rs);class ss{constructor(){this.db=null,this.storage=null,this.auth=null,this.currentUser=null}async initialize(){return await new Promise(e=>{const n=setInterval(()=>{window.firebase&&(clearInterval(n),e())},100)}),window.firebase.apps.length||window.firebase.initializeApp(st),this.auth=window.firebase.auth(),this.db=window.firebase.firestore(),this.storage=window.firebase.storage(),new Promise(e=>{this.auth.onAuthStateChanged(n=>{n?(this.currentUser=n,console.log("✓ Firebase: Authenticated user:",n.uid)):window.location.pathname!=="/login.html"&&window.location.pathname!=="/login"&&(window.location.href="/login.html"),e()})})}async saveBook(e){if(!this.currentUser)throw new Error("User not authenticated");const{data:n,...r}=e,s=this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(),a=`users/${this.currentUser.uid}/epubs/${s.id}.epub`;await this.storage.ref(a).put(n),console.log("✓ Firebase: EPUB uploaded to",a);const o={...r,id:s.id,storagePath:a,createdAt:window.firebase.firestore.FieldValue.serverTimestamp()};return await s.set(o),console.log("✓ Firebase: Book metadata saved to Firestore"),s.id}async getBook(e){if(!this.currentUser)throw new Error("User not authenticated");const n=await this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e).get();if(!n.exists)return null;const r=n.data();try{const s=await this.storage.ref(r.storagePath).getDownloadURL();r.downloadUrl=s}catch(s){console.error("Failed to get download URL",s),r.downloadUrl=null}return r}async getAllBooks(){if(!this.currentUser)throw new Error("User not authenticated");return(await this.db.collection("users").doc(this.currentUser.uid).collection("books").orderBy("createdAt","desc").get()).docs.map(n=>n.data())}async deleteBook(e){if(!this.currentUser)throw new Error("User not authenticated");const n=this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e),r=await n.get();if(r.exists&&r.data().storagePath)try{await this.storage.ref(r.data().storagePath).delete(),console.log("✓ Firebase: EPUB deleted from Storage")}catch(s){if(s.code!=="storage/object-not-found")throw console.error("Error deleting file from storage",s),s}await n.delete(),console.log("✓ Firebase: Book metadata deleted from Firestore"),await this.deleteAnalysis(e)}async updateBook(e,n){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("books").doc(e).update(n)}async saveSetting(e,n){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("settings").doc(e).set({value:n})}async getSetting(e){if(!this.currentUser)throw new Error("User not authenticated");const n=await this.db.collection("users").doc(this.currentUser.uid).collection("settings").doc(e).get();return n.exists?n.data().value:void 0}async getSettings(){return await this.getSetting("reader")||this._getDefaultSettings()}_getDefaultSettings(){return{theme:"light",fontFamily:"serif",fontSize:18,lineHeight:1.6,contentWidth:700,pageMusicSwitch:!1,crossfadeDuration:4}}async saveAnalysis(e,n){if(!this.currentUser)throw new Error("User not authenticated");const r={bookId:e,...n,analyzedAt:window.firebase.firestore.FieldValue.serverTimestamp()};await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).set(r)}async getAnalysis(e){if(!this.currentUser)throw new Error("User not authenticated");const n=await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).get();return n.exists?n.data():null}async deleteAnalysis(e){if(!this.currentUser)throw new Error("User not authenticated");await this.db.collection("users").doc(this.currentUser.uid).collection("analyses").doc(e).delete(),console.log("✓ Firebase: Analysis deleted for book",e)}}export{ss as F};
