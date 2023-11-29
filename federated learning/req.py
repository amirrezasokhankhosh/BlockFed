import requests

domain = "http://localhost:3000/"

def get_param(id):
    url = domain + 'param'
    res = requests.get(url, json={
        "id" : id
    })
    return res.json()

def post_param(id, W, b):
    url = domain + 'param'
    res = requests.post(url, json={
        "id" : id,
        "W" : W,
        "b" : b
    })
    return res.json()

def get_round():
    url = domain + "round"
    res = requests.get(url)
    return res.json()

def get_pre_global():
    r = get_round()
    return get_param(f'global_{r-1}')
