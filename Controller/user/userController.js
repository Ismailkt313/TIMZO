const pageNotFound = async (req,res)=>{
    try {
        res.render(user/error404)
    } catch (error) {
        
    }
}

const loadHome = async (req, res) => {
    try {

        const newArrivals = [
            {
                image: "/images/watch1.jpg",
                title: "Classic Watch",
                rating: 4,
                price: 129.99
            },
            {
                image: "/images/watch2.jpg",
                title: "Modern Watch",
                rating: 5,
                price: 199.99
            }
        ];

        const trendingProducts = [
            {
                image: "/images/watch3.jpg",
                title: "Trending Watch A",
                rating: 5,
                price: 249.99
            },
            {
                image: "/images/watch4.jpg",
                title: "Trending Watch B",
                rating: 4,
                price: 179.99
            }
        ];

        const exploreProducts = [
            {
                image: "/images/watch5.jpg",
                title: "Explorer Watch A",
                rating: 3,
                price: 149.99
            },
            {
                image: "/images/watch6.jpg",
                title: "Explorer Watch B",
                rating: 5,
                price: 229.99
            }
        ];

        return res.render('user/landingPage', {
            newArrivals,
            trendingProducts,
            exploreProducts
        });

    } catch (error) {
        console.log('user homepage not found', error);
        res.status(500).send('server error');
    }
};


module.exports = {
    loadHome,
    pageNotFound
}