# Deferred

When creating a `Promise` in Javascript, it can be helpful to `resolve` or `reject` that promise from outside of the created promise's scope. However, Javascript's built-in `Promise` API does not provide a native solution.

`Deferred` is meant to allow developers to freely create promises and then `resolve` or `reject` them from anywhere in their code, as long as they have a reference to the created `Deferred` object.

### Example Usage

```js
import { Deferred } from '@unifire/async';

async function test() {
    // Create a deferred promise
    const deferred = new Deferred();

    // After 3 seconds, resolve the deferred promise with the value, "Test"
    setTimeout(() => {
        deferred.resolve('Test');
    }, 3000);

    // Obtain the result of deferred once it has resolved
    const deferredResult = await deferred.promise;

    console.log(deferredResult); // 'Test'
}
```

### Constructor Arguments

| Argument | Type | Description |
| --- | --- | --- |
| <i>None</i> | <i>None</i> | <i>None</i> |

### `Deferred` Properties

| Property | Type | Description |
| --- | --- | --- |
| promise | Promise | The native Javascript promise stored by <b>`Deferred`</b>. |

### `Deferred` Methods

| Method | Description |
| --- | --- |
| resolve(*) | The native Javascript `promise.resolve` function used to resolve the native promise stored by <b>`Deferred`</b>.
| reject(*) | The native Javascript `promise.reject` function used to reject the native promise stored by <b>`Deferred`</b>.