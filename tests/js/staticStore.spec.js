import {
  staticAgencyStore,
  staticAuthStore,
  staticCctvStore,
  staticMapSettingStore
} from "../../resources/js/services/api/staticStore";

describe("staticStore client adapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("seeds 15 Banda Aceh CCTV points and supports CRUD, ROI, and condition updates", async () => {
    const initial = await staticCctvStore.list();
    expect(initial).toHaveLength(15);

    const created = await staticCctvStore.create({
      name: "CCTV Pasar",
      category: "Regular",
      address: "Jl. Imam Bonjol",
      lattitude: 5.554,
      longitude: 95.321,
      agency: "Dishub",
      url: null
    });
    expect(created.data.keterangan).toBe("No Data");

    const updatedCond = await staticCctvStore.updateTrafficCondition(1, "Terrible");
    expect(updatedCond.keterangan).toBe("Terrible");
    const fetchedOne = await staticCctvStore.getById(1);
    expect(fetchedOne.keterangan).toBe("Terrible");

    const roiRes = await staticCctvStore.updateRoi(1, {
      points: [
        { x: 10, y: 10 },
        { x: 200, y: 10 },
        { x: 100, y: 200 }
      ]
    });
    expect(roiRes.data.roi_polygon).toHaveLength(3);

    await staticCctvStore.remove(created.data.id);
    const afterRemove = await staticCctvStore.list();
    expect(afterRemove).toHaveLength(15);
  });

  test("manages auth login, logout, map settings, and agency tags", async () => {
    const guest = await staticAuthStore.getAuthUser();
    expect(guest.isAuth).toBe(false);

    const badLogin = await staticAuthStore.login({
      email: "admin@webgista.test",
      password: "wrong"
    });
    expect(badLogin.isAuth).toBe(false);

    const goodLogin = await staticAuthStore.login({
      email: "admin@webgista.test",
      password: "password"
    });
    expect(goodLogin.isAuth).toBe(true);

    await staticMapSettingStore.update(1, { zoom: 14 });
    const settings = await staticMapSettingStore.list();
    expect(settings[0].zoom).toBe(14);

    await staticAgencyStore.create("Polresta");
    const agencies = await staticAgencyStore.list();
    expect(agencies.some((item) => item.agency === "Polresta")).toBe(true);

    await staticAuthStore.logout();
    const afterLogout = await staticAuthStore.getAuthUser();
    expect(afterLogout.isAuth).toBe(false);
  });
});
