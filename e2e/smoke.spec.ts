import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "../playwright.config";

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/?$/);
}

/** `datetime-local` value `days` from now, at the given hour. */
function localDateTime(days: number, hour: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

test("sign-in rejects a wrong password and accepts the right one", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();

  await signIn(page);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("an admin creates and publishes an event, and it goes live", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/events/new");
  await page.getByLabel("Event title").fill("E2E Hack Night");
  await page.getByLabel("Starts").fill(localDateTime(10, 18));
  await page.getByLabel("Ends").fill(localDateTime(10, 21));
  await page.getByLabel("Venue").fill("Lab 3");
  await page.locator('[contenteditable="true"]').first().click();
  await page.keyboard.type("An evening of building things together.");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/events\/[^/?]+/);

  await page.getByRole("button", { name: /^publish/i }).first().click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

  await page.goto("/events/e2e-hack-night");
  await expect(page.getByRole("heading", { level: 1, name: "E2E Hack Night" })).toBeVisible();
  await expect(page.getByText("An evening of building things together.")).toBeVisible();
});

async function answerAboutPage(page: Page, year: string, domain: string) {
  await page.getByRole("radio", { name: year, exact: true }).check({ force: true }); // styled radio: the real input is visually hidden
  await page.getByLabel("domain").selectOption({ label: domain });
}

test("a visitor registers through a branched multi-page form", async ({ page }) => {
  // First years skip the "experience" page.
  await page.goto("/forms/e2e-registration");
  await answerAboutPage(page, "Y1", "Development");
  await expect(page.getByRole("option", { name: "AI/ML" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "React" }).check({ force: true });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "contact", level: 2 })).toBeVisible(); // branch skipped "experience"
  await page.getByLabel("email").fill("first.year@example.edu");
  await page.getByText("Yes", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click(); // review step
  await expect(page.getByText("first.year@example.edu")).toBeVisible();
  await page.waitForTimeout(3_000); // the server rejects instant (bot-like) submissions
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText("Thanks — you're registered!")).toBeVisible();

  // Second years see the "experience" page.
  await page.goto("/forms/e2e-registration");
  await answerAboutPage(page, "Y2", "Design");
  await page.getByLabel("portfolio").fill("https://dribbble.com/e2e");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("textbox", { name: "experience" }).fill("Designed the chapter's event posters.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("email").fill("second.year@example.edu");
  await page.getByText("Yes", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click(); // review step
  await page.waitForTimeout(3_000);
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText("Thanks — you're registered!")).toBeVisible();
});

test("an admin sees and exports the responses", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/forms");
  const href = await page.getByRole("link", { name: /E2E Registration/ }).first().getAttribute("href");
  const formId = /\/admin\/forms\/([^/?]+)/.exec(href ?? "")?.[1];
  expect(formId).toBeTruthy();
  await page.goto(`/admin/forms/${formId}/responses`);
  await expect(page.getByText("first.year@example.edu")).toBeVisible();
  await expect(page.getByText("second.year@example.edu")).toBeVisible();

  const res = await page.request.get(`/api/admin/forms/${formId}/export?format=csv`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/attachment/);
  const csv = await res.text();
  expect(csv).toContain("first.year@example.edu");
  expect(csv).toContain("Designed the chapter's event posters.");

  const xlsx = await page.request.get(`/api/admin/forms/${formId}/export?format=xlsx`);
  expect(xlsx.status()).toBe(200);
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

  const anonymous = await page.context().browser()!.newContext({ baseURL: "http://localhost:3100" });
  expect((await anonymous.request.get(`/api/admin/forms/${formId}/export?format=csv`)).status()).toBe(401);
  await anonymous.close();
});
