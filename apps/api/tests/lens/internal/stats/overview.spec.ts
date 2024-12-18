import axios from "axios";
import { TEST_URL } from "tests/helpers/constants";
import getTestAuthHeaders from "tests/helpers/getTestAuthHeaders";
import { describe, expect, test } from "vitest";

describe("GET /lens/internal/stats/overview", () => {
  test("should return 200 and overview stats", async () => {
    const { data, status } = await axios.get(
      `${TEST_URL}/lens/internal/stats/overview`,
      { headers: getTestAuthHeaders() }
    );

    expect(status).toBe(200);
    expect(data.result).toBeDefined();
    expect(typeof data.result).toBe("object");
    expect(data.result).toHaveProperty("authenticationsCount");
    expect(data.result).toHaveProperty("relayUsageCount");
    expect(data.result).toHaveProperty("postsCount");
    expect(data.result).toHaveProperty("profilesCount");
  });

  test("should return 401 if the user is not staff", async () => {
    try {
      await axios.get(`${TEST_URL}/lens/internal/stats/overview`, {
        headers: getTestAuthHeaders("suspended")
      });
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });

  test("should return 401 if the id token is missing", async () => {
    try {
      await axios.get(`${TEST_URL}/lens/internal/stats/overview`);
    } catch (error: any) {
      expect(error.response.status).toBe(401);
    }
  });
});
