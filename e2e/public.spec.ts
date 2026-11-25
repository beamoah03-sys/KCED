import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page links to the request form and tracker", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Service Requests Portal" })).toBeVisible();
    await page.getByRole("link", { name: "here" }).first().click();
    await expect(page).toHaveURL(/service-request-form/);
  });

  test("request form validates step 1 before moving on", async ({ page }) => {
    await page.goto("/service-request-form");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("This field is required.").first()).toBeVisible();
    await page.getByRole("textbox", { name: "Issue", exact: true }).fill("Streetlight off");
    await page.getByRole("textbox", { name: /Description/ }).fill("Dark near the library");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Location")).toBeVisible();
  });

  test("tracker asks for a reference number", async ({ page }) => {
    await page.goto("/track-service-request");
    await page.getByRole("button", { name: "Track" }).click();
    await expect(page.getByText("Enter a reference number")).toBeVisible();
  });

  test("dashboard redirects anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("unknown pages show the 404", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByText("Page not found")).toBeVisible();
  });
});
