local TERMINAL_CLASSES = {
  codeblock = true,
  terminal = true,
  ["difmap-terminal"] = true,
  ["aips-terminal"] = true,
}

local function has_terminal_class(classes)
  for _, cls in ipairs(classes) do
    if TERMINAL_CLASSES[cls] then
      return true
    end
  end
  return false
end

local function make_header(name, stage)
  local inlines = pandoc.List()
  if name and name ~= "" then
    inlines:insert(pandoc.Span({ pandoc.Str(name) }, pandoc.Attr("", { "terminal-name" })))
  end
  if stage and stage ~= "" then
    if #inlines > 0 then
      inlines:insert(pandoc.Space())
    end
    inlines:insert(pandoc.Span({ pandoc.Str(stage) }, pandoc.Attr("", { "terminal-stage" })))
  end
  if #inlines == 0 then
    return nil
  end
  return pandoc.Para(inlines)
end

function Div(el)
  if not has_terminal_class(el.classes) then
    return nil
  end

  local name = el.attributes["name"]
  local stage = el.attributes["stage"]
  if not name and not stage then
    return nil
  end

  el.attributes["name"] = nil
  el.attributes["stage"] = nil

  local header = make_header(name, stage)
  if header then
    table.insert(el.content, 1, header)
  end
  return el
end

function CodeBlock(el)
  if not has_terminal_class(el.classes) then
    return nil
  end

  local wrapper_classes = pandoc.List()
  local code_classes = pandoc.List()
  for _, cls in ipairs(el.classes) do
    if TERMINAL_CLASSES[cls] then
      wrapper_classes:insert(cls)
    else
      code_classes:insert(cls)
    end
  end

  local name = el.attributes["name"]
  local stage = el.attributes["stage"]
  el.attributes["name"] = nil
  el.attributes["stage"] = nil
  el.classes = code_classes

  local blocks = pandoc.List()
  local header = make_header(name, stage)
  if header then
    blocks:insert(header)
  end
  blocks:insert(el)

  return pandoc.Div(blocks, pandoc.Attr("", wrapper_classes))
end
