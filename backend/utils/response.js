export const ok = (res, payload = {}, message = "OK", status = 200) =>
  res.status(status).json({ success: true, message, ...payload })

export const created = (res, payload = {}, message = "Created") =>
  ok(res, payload, message, 201)
