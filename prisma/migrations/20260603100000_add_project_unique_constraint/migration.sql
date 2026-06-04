-- Add unique constraint on projects (category, brand, business_line, project_name)
-- Ensures no duplicate project with the same combination exists
CREATE UNIQUE INDEX "projects_category_brand_business_line_project_name_key"
ON "projects"("category", "brand", "business_line", "project_name");
