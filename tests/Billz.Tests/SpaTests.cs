using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Billz.Tests;

public class SpaTests
{
    [Fact]
    public async Task StaticSpaIsServedAndApiMissesStayJson()
    {
        DirectoryInfo? webRoot = null;

        try
        {
            webRoot = Directory.CreateTempSubdirectory("billz-webroot-");
            var indexPath = Path.Combine(webRoot.FullName, "index.html");
            var assetsDirectory = Directory.CreateDirectory(
                Path.Combine(webRoot.FullName, "assets")
            );
            var assetPath = Path.Combine(assetsDirectory.FullName, "app-123.js");
            await File.WriteAllTextAsync(indexPath, "<!doctype html><title>Billz</title>");
            await File.WriteAllTextAsync(assetPath, "console.log('billz');");

            await using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder => builder.UseWebRoot(webRoot.FullName));
            var client = factory.CreateClient();

            var root = await client.GetAsync("/");
            Assert.Equal(HttpStatusCode.OK, root.StatusCode);
            Assert.Equal("text/html", root.Content.Headers.ContentType?.MediaType);
            Assert.Contains("Billz", await root.Content.ReadAsStringAsync());
            Assert.Equal("no-cache", root.Headers.CacheControl?.ToString());

            var clientRoute = await client.GetAsync("/bills");
            Assert.Equal(HttpStatusCode.OK, clientRoute.StatusCode);
            Assert.Contains("Billz", await clientRoute.Content.ReadAsStringAsync());
            Assert.Equal("no-cache", clientRoute.Headers.CacheControl?.ToString());

            var asset = await client.GetAsync("/assets/app-123.js");
            Assert.Equal(HttpStatusCode.OK, asset.StatusCode);
            Assert.Equal(
                "public, max-age=31536000, immutable",
                asset.Headers.CacheControl?.ToString()
            );

            var apiMiss = await client.GetAsync("/api/does-not-exist");
            Assert.Equal(HttpStatusCode.NotFound, apiMiss.StatusCode);
            Assert.Equal("application/problem+json", apiMiss.Content.Headers.ContentType?.MediaType);
            Assert.DoesNotContain("Billz", await apiMiss.Content.ReadAsStringAsync());
            Assert.Equal("no-cache", apiMiss.Headers.CacheControl?.ToString());
        }
        finally
        {
            webRoot?.Delete(recursive: true);
        }
    }
}
