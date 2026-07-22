const { resolveEffectiveDentistId } = require('../src/utils/authorizationHelpers');

function makeReq(roles, sub) {
  return { user: { sub, roles } };
}

describe('resolveEffectiveDentistId', () => {
  it('diş hekimi dentistId göndermezse kendi ID döner', async () => {
    const req = makeReq(['dentist'], 7);
    const queryFn = jest.fn();
    const result = await resolveEffectiveDentistId(req, queryFn, undefined);
    expect(result).toBe(7);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('diş hekimi kendi ID’sini açıkça gönderirse kabul edilir', async () => {
    const req = makeReq(['dentist'], 7);
    const queryFn = jest.fn();
    const result = await resolveEffectiveDentistId(req, queryFn, 7);
    expect(result).toBe(7);
  });

  it('diş hekimi başka bir dentistId gönderirse 403 AppError fırlatır', async () => {
    const req = makeReq(['dentist'], 7);
    const queryFn = jest.fn();
    await expect(
      resolveEffectiveDentistId(req, queryFn, 9),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('sekreter dentistId göndermezse null döner (zorla kendine atamaz)', async () => {
    const req = makeReq(['secretary'], 2);
    const queryFn = jest.fn();
    const result = await resolveEffectiveDentistId(req, queryFn, undefined);
    expect(result).toBeNull();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('sekreter geçerli/aktif bir dişhekimi seçtiğinde kabul edilir', async () => {
    const req = makeReq(['secretary'], 2);
    const queryFn = jest.fn().mockResolvedValue({ rows: [{ id: 7 }] });
    const result = await resolveEffectiveDentistId(req, queryFn, 7);
    expect(result).toBe(7);
    expect(queryFn).toHaveBeenCalledWith(
      expect.stringContaining("roles LIKE '%dentist%'"),
      [7],
    );
  });

  it('sekreter dişhekimi rolü olmayan/silinmiş bir kullanıcı seçerse 400 döner', async () => {
    const req = makeReq(['secretary'], 2);
    const queryFn = jest.fn().mockResolvedValue({ rows: [] });
    await expect(
      resolveEffectiveDentistId(req, queryFn, 99),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('admin+dentist çok rollü kullanıcı başka bir dişhekimi seçebilir (audit çağıran tarafça loglanır)', async () => {
    const req = makeReq(['admin', 'dentist'], 1);
    const queryFn = jest.fn().mockResolvedValue({ rows: [{ id: 7 }] });
    const result = await resolveEffectiveDentistId(req, queryFn, 7);
    expect(result).toBe(7);
  });
});
