"""Wait for a JS condition without wait_for_function.

wait_for_function runs its predicate through eval inside the page, which the app's Content-Security-Policy blocks
('unsafe-eval'). page.evaluate is not blocked, so this polls with evaluate until the expression is truthy.
Usage: wait_for(page, "() => ...") or wait_for(page, "a => ...", arg)."""
import time

def wait_for(page, js, arg=None, timeout=10000):
    end = time.time() + timeout / 1000.0
    last = None
    while time.time() < end:
        last = page.evaluate(js) if arg is None else page.evaluate(js, arg)
        if last:
            return last
        time.sleep(0.1)
    raise TimeoutError("condition not met within %d ms: %s" % (timeout, js[:100]))
